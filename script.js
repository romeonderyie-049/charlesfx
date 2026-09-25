/*
  DIGIT ANALYSIS PRO
  ==================
  Live Deriv market tick analyzer

  This version:
  - Connects to Deriv WebSocket
  - Receives live ticks
  - Extracts the last digit
  - Tracks ALL digits 0-9
  - Does NOT limit analysis to 100 digits
  - Shows frequency percentages
  - Shows recent digits
  - Automatically reconnects after an unexpected disconnect
*/


let socket = null;
let connected = false;

let digits = [];

let digitCounts = [
  0, 0, 0, 0, 0,
  0, 0, 0, 0, 0
];

let reconnectTimer = null;
let reconnectAttempts = 0;


// --------------------------------------------------
// ELEMENTS
// --------------------------------------------------

const statusEl =
  document.getElementById("status");

const connectBtn =
  document.getElementById("connectBtn");

const disconnectBtn =
  document.getElementById("disconnectBtn");

const symbolEl =
  document.getElementById("symbol");

const connectionMessage =
  document.getElementById("connectionMessage");


// --------------------------------------------------
// STATUS
// --------------------------------------------------

function setStatus(text, className) {

  statusEl.textContent = text;

  statusEl.className =
    "status " + className;
}


// --------------------------------------------------
// CONNECT TO DERIV
// --------------------------------------------------

function connect() {

  if (
    socket &&
    socket.readyState === WebSocket.OPEN
  ) {
    return;
  }

  clearTimeout(reconnectTimer);

  const symbol =
    symbolEl.value;

  setStatus(
    "CONNECTING...",
    "connecting"
  );

  connectionMessage.textContent =
    "Connecting to Deriv market data...";


  /*
    Public Deriv WebSocket.

    The app ID below is used for the public
    market-data connection.
  */

  socket = new WebSocket(
    "wss://ws.derivws.com/websockets/v3?app_id=1089"
  );


  // ------------------------------------------------
  // SOCKET OPEN
  // ------------------------------------------------

  socket.onopen = function () {

    connected = true;

    reconnectAttempts = 0;

    setStatus(
      "CONNECTED",
      "connected"
    );

    connectBtn.disabled = true;

    disconnectBtn.disabled = false;

    connectionMessage.textContent =
      "Live market data connected.";


    // Subscribe to selected market
    socket.send(
      JSON.stringify({
        ticks: symbol,
        subscribe: 1
      })
    );

  };


  // ------------------------------------------------
  // RECEIVE MESSAGE
  // ------------------------------------------------

  socket.onmessage = function (event) {

    try {

      const data =
        JSON.parse(event.data);


      // Deriv API error
      if (data.error) {

        console.error(
          "Deriv error:",
          data.error.message
        );

        connectionMessage.textContent =
          data.error.message;

        return;
      }


      // Live tick
      if (
        data.msg_type === "tick" &&
        data.tick
      ) {

        processTick(
          data.tick
        );

      }

    }

    catch (error) {

      console.error(
        "Message processing error:",
        error
      );

    }

  };


  // ------------------------------------------------
  // SOCKET ERROR
  // ------------------------------------------------

  socket.onerror = function (error) {

    console.error(
      "WebSocket error:",
      error
    );

    setStatus(
      "ERROR",
      "disconnected"
    );

    connectionMessage.textContent =
      "Connection error. Trying again...";
  };


  // ------------------------------------------------
  // SOCKET CLOSED
  // ------------------------------------------------

  socket.onclose = function () {

    const wasConnected =
      connected;

    connected = false;

    socket = null;

    setStatus(
      "DISCONNECTED",
      "disconnected"
    );

    connectBtn.disabled = false;

    disconnectBtn.disabled = true;


    if (wasConnected) {

      connectionMessage.textContent =
        "Connection closed.";

    }


    /*
      Automatic reconnect.

      Only happens when the user has not
      manually disconnected.
    */

    if (wasConnected) {

      scheduleReconnect();

    }

  };

}


// --------------------------------------------------
// AUTOMATIC RECONNECT
// --------------------------------------------------

function scheduleReconnect() {

  clearTimeout(
    reconnectTimer
  );


  reconnectAttempts++;


  const delay =
    Math.min(
      30000,
      2000 * reconnectAttempts
    );


  connectionMessage.textContent =
    "Reconnecting in " +
    Math.ceil(delay / 1000) +
    " seconds...";


  reconnectTimer =
    setTimeout(
      function () {

        if (!connected) {
          connect();
        }

      },
      delay
    );

}


// --------------------------------------------------
// DISCONNECT
// --------------------------------------------------

function disconnect() {

  clearTimeout(
    reconnectTimer
  );

  reconnectAttempts = 0;


  if (socket) {

    socket.onclose = null;

    socket.close();

  }


  socket = null;

  connected = false;


  setStatus(
    "DISCONNECTED",
    "disconnected"
  );

  connectBtn.disabled = false;

  disconnectBtn.disabled = true;

  connectionMessage.textContent =
    "Disconnected by user.";

}


// --------------------------------------------------
// PROCESS TICK
// --------------------------------------------------

function processTick(tick) {

  const quote =
    Number(tick.quote);


  if (!Number.isFinite(quote)) {
    return;
  }


  /*
    Deriv supplies the quote according to the
    market's decimal precision.

    We convert the quote to a string and take
    the final numeric digit.
  */

  const quoteString =
    String(tick.quote);


  const numericPart =
    quoteString.replace(
      /[^0-9]/g,
      ""
    );


  if (!numericPart.length) {
    return;
  }


  const lastCharacter =
    numericPart.charAt(
      numericPart.length - 1
    );


  const digit =
    Number(lastCharacter);


  if (
    !Number.isInteger(digit) ||
    digit < 0 ||
    digit > 9
  ) {

    return;

  }


  // Store the digit
  digits.push(digit);


  // Increase its count
  digitCounts[digit]++;


  // Update interface
  updateCurrentTick(
    tick,
    digit
  );

  updateAnalysis();

}


// --------------------------------------------------
// CURRENT TICK
// --------------------------------------------------

function updateCurrentTick(
  tick,
  digit
) {

  const currentDigit =
    document.getElementById(
      "currentDigit"
    );

  const currentPrice =
    document.getElementById(
      "currentPrice"
    );

  const tickTime =
    document.getElementById(
      "tickTime"
    );


  currentDigit.textContent =
    digit;


  currentPrice.textContent =
    "Price: " +
    Number(tick.quote).toFixed(5);


  if (tick.epoch) {

    const date =
      new Date(
        tick.epoch * 1000
      );


    tickTime.textContent =
      date.toLocaleTimeString();

  }

}


// --------------------------------------------------
// UPDATE ALL ANALYSIS
// --------------------------------------------------

function updateAnalysis() {

  const total =
    digits.length;


  updateTable(
    total
  );


  updateDistribution(
    total
  );


  updateRecentDigits();


  updateStatistics(
    total
  );

}


// --------------------------------------------------
// TABLE
// --------------------------------------------------

function updateTable(total) {

  const table =
    document.getElementById(
      "digitTable"
    );


  if (!table) {
    return;
  }


  table.innerHTML = "";


  /*
    Recent window is ONLY used for the
    "Recent" column.

    It does NOT affect the main statistics.
  */

  const recent =
    digits.slice(-20);


  for (
    let digit = 0;
    digit <= 9;
    digit++
  ) {

    const count =
      digitCounts[digit];


    const frequency =
      total > 0
        ? (
            count / total
          ) * 100
        : 0;


    const recentCount =
      recent.filter(
        d => d === digit
      ).length;


    const row =
      document.createElement(
        "tr"
      );


    row.innerHTML = `

      <td>
        <strong>${digit}</strong>
      </td>

      <td>
        ${count}
      </td>

      <td>
        ${frequency.toFixed(2)}%
      </td>

      <td>
        ${recentCount}/20
      </td>

      <td>

        <div class="table-bar">

          <div
            class="table-fill"
            style="width:${frequency}%"
          ></div>

        </div>

      </td>

    `;


    table.appendChild(
      row
    );

  }

}


// --------------------------------------------------
// DISTRIBUTION BARS
// --------------------------------------------------

function updateDistribution(total) {

  for (
    let digit = 0;
    digit <= 9;
    digit++
  ) {

    const percentage =
      total > 0
        ? (
            digitCounts[digit] /
            total
          ) * 100
        : 0;


    const bar =
      document.getElementById(
        "bar" + digit
      );


    const percent =
      document.getElementById(
        "percent" + digit
      );


    if (bar) {

      bar.style.width =
        percentage.toFixed(2) +
        "%";

    }


    if (percent) {

      percent.textContent =
        percentage.toFixed(2) +
        "%";

    }

  }

}


// --------------------------------------------------
// RECENT DIGITS
// --------------------------------------------------

function updateRecentDigits() {

  const container =
    document.getElementById(
      "recentDigits"
    );


  if (!container) {
    return;
  }


  if (!digits.length) {

    container.textContent =
      "No data yet";

    return;

  }


  const recent =
    digits.slice(-30);


  container.innerHTML =
    recent
      .map(
        function (digit) {

          return `
            <span class="recent-digit">
              ${digit}
            </span>
          `;

        }
      )
      .join("");

}


// --------------------------------------------------
// STATISTICS
// --------------------------------------------------

function updateStatistics(total) {

  const totalTicks =
    document.getElementById(
      "totalTicks"
    );


  const uniqueDigits =
    document.getElementById(
      "uniqueDigits"
    );


  const mostFrequent =
    document.getElementById(
      "mostFrequent"
    );


  const leastFrequent =
    document.getElementById(
      "leastFrequent"
    );


  const summary =
    document.getElementById(
      "analysisSummary"
    );


  if (totalTicks) {

    totalTicks.textContent =
      total;

  }


  const unique =
    digitCounts.filter(
      count => count > 0
    ).length;


  if (uniqueDigits) {

    uniqueDigits.textContent =
      unique;

  }


  if (total === 0) {

    mostFrequent.textContent =
      "-";

    leastFrequent.textContent =
      "-";

    summary.textContent =
      "Waiting for live data...";

    return;

  }


  const highest =
    Math.max(
      ...digitCounts
    );


  const lowest =
    Math.min(
      ...digitCounts
    );


  const most = [];

  const least = [];


  for (
    let digit = 0;
    digit <= 9;
    digit++
  ) {

    if (
      digitCounts[digit] ===
      highest
    ) {

      most.push(digit);

    }


    if (
      digitCounts[digit] ===
      lowest
    ) {

      least.push(digit);

    }

  }


  mostFrequent.textContent =
    most.join(", ");


  leastFrequent.textContent =
    least.join(", ");


  const highestPercentage =
    (
      highest / total
    ) * 100;


  summary.innerHTML = `

    <div class="analysis-main">

      Most frequent:
      <strong>
        ${most.join(", ")}
      </strong>

    </div>

    <div class="analysis-secondary">

      Observed frequency:
      ${highestPercentage.toFixed(2)}%

      <br>

      Total analyzed ticks:
      ${total}

    </div>

  `;

}


// --------------------------------------------------
// CLEAR DATA
// --------------------------------------------------

function clearData() {

  digits = [];


  digitCounts = [
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0
  ];


  document.getElementById(
    "currentDigit"
  ).textContent = "-";


  document.getElementById(
    "currentPrice"
  ).textContent =
    "Waiting for tick...";


  document.getElementById(
    "tickTime"
  ).textContent =
    "--";


  updateAnalysis();


  connectionMessage.textContent =
    connected
      ? "Data cleared. Continuing live analysis."
      : "Data cleared.";

}


// --------------------------------------------------
// MARKET CHANGE
// --------------------------------------------------

symbolEl.addEventListener(
  "change",
  function () {

    if (connected) {

      disconnect();

      setTimeout(
        function () {
          connect();
        },
        500
      );

    }

  }
);


// --------------------------------------------------
// INITIAL STATE
// --------------------------------------------------

setStatus(
  "DISCONNECTED",
  "disconnected"
);

updateAnalysis();
