let db;
let currentChallengeIndex = 0;
let challenges = [];
let SQLglobal = null;

const levelOrder = ["Beginner", "Intermediate", "Advanced"];
let orderedChallengeIndices = [];

function highlightSQLNode(sql) {
  // Combined regex to capture keywords, functions, strings, comments, and operators
  const tokenRegex = /\b(SELECT|FROM|WHERE|JOIN|ON|AS|GROUP BY|ORDER BY|INSERT INTO|VALUES|UPDATE|SET|DELETE)\b|('[^']*')|\b(SUM|COUNT|AVG|MIN|MAX)\b|(--[^\n]*)|([=><]+)/gi;
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(sql)) !== null) {
    // Append text before match
    if (match.index > lastIndex) {
      fragment.append(document.createTextNode(sql.slice(lastIndex, match.index)));
    }

    let span = null;
    if (match[1]) { // keywords
      span = document.createElement("span");
      span.className = "sql-keyword";
      span.textContent = match[1];
    } else if (match[2]) { // string literals
      span = document.createElement("span");
      span.className = "sql-string";
      span.textContent = match[2];
    } else if (match[3]) { // functions
      span = document.createElement("span");
      span.className = "sql-function";
      span.textContent = match[3];
    } else if (match[4]) { // comments
      span = document.createElement("span");
      span.className = "sql-comment";
      span.textContent = match[4];
    } else if (match[5]) { // operators
      span = document.createElement("span");
      span.className = "sql-operator";
      span.textContent = match[5];
    }

    if (span) {
      fragment.append(span);
    } else {
      // Fallback: raw matched text
      fragment.append(document.createTextNode(match[0]));
    }

    lastIndex = tokenRegex.lastIndex;
  }

  // Trailing text
  if (lastIndex < sql.length) {
    fragment.append(document.createTextNode(sql.slice(lastIndex)));
  }

  return fragment;
}

fetch("challenges.json")
  .then(res => res.json())
  .then(data => {
    challenges = data;
    return initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/sql-wasm.wasm`
    });
  })
  .then(SQL => {
    SQLglobal = SQL; // keep for reuse
    // read hash if present
    currentChallengeIndex = getIndexFromHash();
    orderedChallengeIndices = buildOrderedIndices();
    populateChallengeSelector();
    loadChallenge(SQLglobal, currentChallengeIndex);
    setupChallengeNav();
  });

function loadChallenge(SQL, index) {
const challenge = challenges[index];
  currentChallengeIndex = index;

  // Title
  const titleEl = document.getElementById("challenge-title");
  titleEl.textContent = challenge.title;

  // Level badge
  let levelEl = document.getElementById("challenge-level");
  if (!levelEl) {
    // fallback if not in DOM
    levelEl = document.createElement("div");
    levelEl.id = "challenge-level";
    levelEl.className = "level-badge";
    titleEl.insertAdjacentElement("afterend", levelEl);
  }
// after you get the challenge object
levelEl.textContent = challenge.level ? challenge.level : "Unspecified";
levelEl.className = `level-badge ${(challenge.level || "unspecified").toLowerCase()}`;
  document.getElementById("challenge-description").textContent = challenge.description;

  db = new SQL.Database();
  db.run(challenge.schema);

  document.getElementById("sql-input").value = "";
  document.getElementById("results").innerHTML = "";
  document.getElementById("feedback").innerHTML = "";

  renderAllTables();
  renderAnswer(challenge.answer);
}

function runQuery() {
  const input = document.getElementById("sql-input").value;
  const resultsDiv = document.getElementById("results");
  const feedbackDiv = document.getElementById("feedback");
  resultsDiv.innerHTML = "";
  feedbackDiv.innerHTML = "";

  try {
    const res = db.exec(input);
    if (res.length === 0) {
      feedbackDiv.innerHTML = "No results.";
      feedbackDiv.className = "error";
      return;
    }

    const output = res[0];
    const headers = output.columns;
    const rows = output.values.map(row => {
      let obj = {};
      row.forEach((val, idx) => {
        obj[headers[idx]] = val;
      });
      return obj;
    });

    renderResultsTable(headers, output.values, resultsDiv);
    validateQuery(rows);
  } catch (err) {
    feedbackDiv.innerHTML = err.message;
    feedbackDiv.className = "error";
  }
}

function validateQuery(rows) {
  const expected = challenges[currentChallengeIndex].expectedResult;
  const match = JSON.stringify(rows) === JSON.stringify(expected);

  const feedbackDiv = document.getElementById("feedback");
  feedbackDiv.className = match ? "success" : "error";
}

function renderAllTables() {
  const container = document.getElementById("table-view");
  container.innerHTML = "";

  const tableNames = db.exec("SELECT name FROM sqlite_master WHERE type='table';")[0]?.values.map(row => row[0]) || [];

  tableNames.forEach(name => {
    const res = db.exec(`SELECT * FROM ${name}`);
    if (res.length === 0) return;

    const table = document.createElement("table");
    const caption = document.createElement("caption");
    caption.textContent = name;
    table.appendChild(caption);

    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");

    const headers = res[0].columns;
    const headRow = document.createElement("tr");
    headers.forEach(col => {
      const th = document.createElement("th");
      th.textContent = col;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    res[0].values.forEach(row => {
      const tr = document.createElement("tr");
      row.forEach(cell => {
        const td = document.createElement("td");
        td.textContent = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    container.appendChild(table);
  });
}

function renderResultsTable(headers, values, container) {
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  const headRow = document.createElement("tr");
  headers.forEach(col => {
    const th = document.createElement("th");
    th.textContent = col;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  values.forEach(row => {
    const tr = document.createElement("tr");
    row.forEach(cell => {
      const td = document.createElement("td");
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderAnswer(answer) {
  const box = document.getElementById("answer-box");
  box.innerHTML = "";

  if (!answer) {
    box.innerHTML = "<p>No answer available.</p>";
    return;
  }

  // Explanation (fixed: separate heading from paragraph)
  const explanationHeader = document.createElement("h4");
  explanationHeader.textContent = "Explanation:";
  box.appendChild(explanationHeader);

  const explanationPara = document.createElement("p");
  explanationPara.innerHTML = answer.explanation;
  box.appendChild(explanationPara);

  // Step-by-step Breakdown
  if (answer.steps && answer.steps.length > 0) {
    const stepsHeader = document.createElement("h4");
    stepsHeader.textContent = "Step-by-step Breakdown:";
    box.appendChild(stepsHeader);

    answer.steps.forEach(step => {
      const stepWrapper = document.createElement("div");
      stepWrapper.style.marginBottom = "1.5rem";

      const stepCode = document.createElement("pre");
      if (step.final) {
        stepCode.classList.add("final-step");
      }

      const codeInner = document.createElement("code");
      // Use DOM-based highlighter instead of raw HTML string
      codeInner.append(highlightSQLNode(step.sql));
      stepCode.appendChild(codeInner);

      // keep base styling (CSS handles final-step)
      stepCode.style.padding = "0.5rem";
      stepCode.style.marginBottom = "0.25rem";
      stepCode.style.whiteSpace = "pre-wrap";

      const desc = document.createElement("p");
      desc.innerHTML = step.description || "";

      stepWrapper.appendChild(stepCode);
      stepWrapper.appendChild(desc);
      box.appendChild(stepWrapper);
    });
  }

  // Example table
  if (answer.exampleTable) {
    const beforeTable = renderMiniTable(answer.exampleTable.before, "Before");
    const afterTable = renderMiniTable(answer.exampleTable.after, "After");
    box.appendChild(beforeTable);
    box.appendChild(afterTable);
  }
}

function renderMiniTable(data, label) {
  const wrapper = document.createElement("div");
  wrapper.style.marginTop = "1rem";

  const heading = document.createElement("h4");
  heading.textContent = `${label} Table`;
  wrapper.appendChild(heading);

  if (!data || data.length === 0) {
    const emptyNote = document.createElement("p");
    emptyNote.textContent = "(empty)";
    wrapper.appendChild(emptyNote);
    return wrapper;
  }

  const table = document.createElement("table");
  const headers = Object.keys(data[0]);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach(col => {
    const th = document.createElement("th");
    th.textContent = col;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  data.forEach(row => {
    const tr = document.createElement("tr");
    headers.forEach(col => {
      const td = document.createElement("td");
      td.textContent = row[col];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrapper.appendChild(table);
  return wrapper;
}

function buildOrderedIndices() {
  const groups = {};
  challenges.forEach((c, i) => {
    const lvl = c.level || "Unspecified";
    if (!groups[lvl]) groups[lvl] = [];
    groups[lvl].push({ title: c.title, index: i });
  });

  const orderedLevels = [
    ...levelOrder.filter(l => groups[l]),
    ...Object.keys(groups).filter(l => !levelOrder.includes(l)).sort()
  ];

  const ordered = [];
  orderedLevels.forEach(lvl => {
    groups[lvl]
      .sort((a, b) => a.title.localeCompare(b.title))
      .forEach(o => ordered.push(o.index));
  });
  return ordered;
}

function getLogicalPosition(origIndex) {
  return orderedChallengeIndices.indexOf(origIndex);
}

function populateChallengeSelector() {
  const select = document.getElementById("challenge-select");
  select.innerHTML = "";

  // Group challenges by level, keeping their original index
  const groups = challenges.reduce((acc, challenge, idx) => {
    const lvl = challenge.level || "Unspecified";
    if (!acc[lvl]) acc[lvl] = [];
    acc[lvl].push({ challenge, index: idx });
    return acc;
  }, {});

  // Build ordered list of levels: explicit order first, then any extra levels
  const orderedLevels = [
    ...levelOrder.filter(l => groups[l]),
    ...Object.keys(groups).filter(l => !levelOrder.includes(l)).sort()
  ];

  orderedLevels.forEach(level => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = level;

    // Optional: sort titles within a level alphabetically for predictability
    groups[level]
      .sort((a, b) => a.challenge.title.localeCompare(b.challenge.title))
      .forEach(({ challenge, index }) => {
        const opt = document.createElement("option");
        opt.value = index;
        opt.textContent = challenge.title;
        if (index === currentChallengeIndex) opt.selected = true;
        optgroup.appendChild(opt);
      });

    select.appendChild(optgroup);
  });
}

function updateNavControls() {
  const pos = getLogicalPosition(currentChallengeIndex);
  document.getElementById("prev-challenge").disabled = pos <= 0;
  document.getElementById("next-challenge").disabled =
    pos === -1 || pos >= orderedChallengeIndices.length - 1;
  const select = document.getElementById("challenge-select");
  if (select) select.value = currentChallengeIndex;
}

function setChallenge(index) {
  if (index < 0 || index >= challenges.length) return;
  currentChallengeIndex = index;
  // reflect in URL for bookmarking/share
  location.hash = `challenge=${currentChallengeIndex}`;
  populateChallengeSelector();
  updateNavControls();
  loadChallenge(SQLglobal, currentChallengeIndex);
}

function goPrevious() {
  const pos = getLogicalPosition(currentChallengeIndex);
  if (pos > 0) {
    setChallenge(orderedChallengeIndices[pos - 1]);
  }
}

function goNext() {
  const pos = getLogicalPosition(currentChallengeIndex);
  if (pos >= 0 && pos < orderedChallengeIndices.length - 1) {
    setChallenge(orderedChallengeIndices[pos + 1]);
  }
}

function setupChallengeNav() {
  document.getElementById("prev-challenge").addEventListener("click", goPrevious);
  document.getElementById("next-challenge").addEventListener("click", goNext);
  document.getElementById("challenge-select").addEventListener("change", e => {
    setChallenge(parseInt(e.target.value, 10));
  });

  // initial enable/disable
  updateNavControls();
}

function getIndexFromHash() {
  const m = location.hash.match(/challenge=(\d+)/);
  if (m) {
    const i = parseInt(m[1], 10);
    if (!isNaN(i) && i >= 0 && i < challenges.length) return i;
  }
  return 0;
}