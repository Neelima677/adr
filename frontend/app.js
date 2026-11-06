const API_BASE = "http://127.0.0.1:8000";

const pages = document.querySelectorAll(".page-section");
const navButtons = document.querySelectorAll(".nav-btn[data-page]");

const goPredictionBtn = document.getElementById("goPredictionBtn");
const goDashboardBtn = document.getElementById("goDashboardBtn");
const homeAnalyzeBtn = document.getElementById("homeAnalyzeBtn");
const homeHistoryBtn = document.getElementById("homeHistoryBtn");
const predictionBackBtn = document.getElementById("predictionBackBtn");
const openDashboardBtn = document.getElementById("openDashboardBtn");

const analyzeBtn = document.getElementById("analyzeBtn");
const clearBtn = document.getElementById("clearBtn");
const sampleBtn = document.getElementById("sampleBtn");

const backButtons = document.querySelectorAll(".back-btn");
const logoutBtnSidebar = document.getElementById("logoutBtnSidebar");

const drugInput = document.getElementById("drug_name");
const reviewInput = document.getElementById("review_text");
const loading = document.getElementById("loading");
const resultSection = document.getElementById("resultSection");
const apiStatus = document.getElementById("apiStatus");
const historyTableBody = document.getElementById("historyTableBody");

let analysisHistory = JSON.parse(localStorage.getItem("predictionHistory") || "[]");

function requireLogin() {
  const user = localStorage.getItem("user");
  if (!user) {
    window.location.href = "login.html";
  }
}

function logout() {
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

function showPage(pageId) {
  pages.forEach((page) => page.classList.remove("active-page"));

  const selectedPage = document.getElementById(pageId);
  if (selectedPage) {
    selectedPage.classList.add("active-page");
  }

  navButtons.forEach((btn) => btn.classList.remove("active"));
  const activeBtn = [...navButtons].find((btn) => btn.dataset.page === pageId);
  if (activeBtn) {
    activeBtn.classList.add("active");
  }
}

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => showPage(btn.dataset.page));
});

backButtons.forEach((btn) => {
  btn.addEventListener("click", () => showPage(btn.dataset.back));
});

goPredictionBtn?.addEventListener("click", () => showPage("predictionPage"));
goDashboardBtn?.addEventListener("click", () => {
  window.location.href = "dashboard.html";
});
openDashboardBtn?.addEventListener("click", () => {
  window.location.href = "dashboard.html";
});
homeAnalyzeBtn?.addEventListener("click", () => showPage("predictionPage"));
homeHistoryBtn?.addEventListener("click", () => showPage("historyPage"));
predictionBackBtn?.addEventListener("click", () => showPage("homePage"));
logoutBtnSidebar?.addEventListener("click", logout);

function setBadgeStyle(element, text, type) {
  if (!element) return;

  element.textContent = text;
  element.className = "badge";

  if (type === "negative") {
    element.classList.add("negative-badge");
  } else if (type === "neutral") {
    element.classList.add("neutral-badge");
  } else if (type === "positive") {
    element.classList.add("positive-badge");
  } else if (type === "adr-yes") {
    element.classList.add("adr-badge");
  } else if (type === "adr-no") {
    element.classList.add("safe-badge");
  } else {
    element.classList.add("neutral-badge");
  }
}

function getRiskLevel(sentiment, adrPresent, adrProbability, symptoms) {
  const sentimentValue = (sentiment || "").toLowerCase();
  const hasSymptoms = Array.isArray(symptoms) && symptoms.length > 0;
  const adrDetected = adrPresent === 1 || adrPresent === true;
  const probability = Number(adrProbability || 0);

  if (sentimentValue === "positive") {
    if (adrDetected || hasSymptoms || probability >= 0.5) {
      return {
        label: "Moderate Risk",
        className: "moderate-risk",
        text: "The review is positive, but some ADR-related signal was detected."
      };
    }

    return {
      label: "Low Risk",
      className: "low-risk",
      text: "Positive review with no major ADR concern detected."
    };
  }

  if (sentimentValue === "negative" && (adrDetected || hasSymptoms || probability >= 0.5)) {
    return {
      label: "High Risk",
      className: "high-risk",
      text: "Negative review with strong ADR-related signal detected. Further attention is advised."
    };
  }

  if (sentimentValue === "neutral" && (adrDetected || hasSymptoms || probability >= 0.5)) {
    return {
      label: "Moderate Risk",
      className: "moderate-risk",
      text: "Neutral review with some ADR-related signal detected."
    };
  }

  if (sentimentValue === "negative") {
    return {
      label: "Moderate Risk",
      className: "moderate-risk",
      text: "Negative sentiment detected, but no strong ADR evidence was found."
    };
  }

  return {
    label: "Low Risk",
    className: "low-risk",
    text: "No major ADR concern detected from the current review."
  };
}

function getRecommendation(sentiment, adrPresent, symptoms) {
  const hasSymptoms = Array.isArray(symptoms) && symptoms.length > 0;

  if ((adrPresent === 1 || adrPresent === true) && hasSymptoms) {
    return `Possible adverse reaction indicators were found. Monitor symptoms such as ${symptoms.join(", ")} and review the case if required.`;
  }

  if ((sentiment || "").toLowerCase() === "negative") {
    return "The review shows negative sentiment. Patient follow-up may be useful even if symptom evidence is limited.";
  }

  if ((sentiment || "").toLowerCase() === "neutral") {
    return "The review appears neutral. Continue monitoring and interpret it in the overall clinical context.";
  }

  return "The review appears positive and no strong ADR-related signal is indicated by the current output.";
}

function renderSymptoms(symptoms) {
  const symptomsBox = document.getElementById("symptomsOut");
  if (!symptomsBox) return;

  if (!symptoms || symptoms.length === 0) {
    symptomsBox.innerHTML = '<span class="empty-text">No symptoms detected</span>';
    return;
  }

  symptomsBox.innerHTML = symptoms
    .map((symptom) => `<span class="symptom-chip">${symptom}</span>`)
    .join("");
}

function renderHistoryTable() {
  if (!historyTableBody) return;

  const history = JSON.parse(localStorage.getItem("predictionHistory") || "[]");

  if (history.length === 0) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">No analyses yet</td>
      </tr>
    `;
    return;
  }

  historyTableBody.innerHTML = history
    .slice()
    .reverse()
    .map(
      (item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.drugName || "-"}</td>
        <td>${item.sentiment || "-"}</td>
        <td>${item.adrLabel || "-"}</td>
        <td>${item.risk || "-"}</td>
        <td>${(item.symptoms || []).join(", ") || "None"}</td>
      </tr>
    `
    )
    .join("");
}

async function checkBackend() {
  try {
    const response = await fetch(`${API_BASE}/`);
    const data = await response.json();

    if (apiStatus) {
      apiStatus.textContent = data.message
        ? "Backend connected successfully"
        : "Backend connected";
    }
  } catch (error) {
    if (apiStatus) {
      apiStatus.textContent = "Backend not running";
    }
  }
}

function clearForm() {
  if (drugInput) drugInput.value = "";
  if (reviewInput) reviewInput.value = "";

  document.getElementById("drugOut").textContent = "-";
  setBadgeStyle(document.getElementById("sentimentOut"), "-", "neutral");
  setBadgeStyle(document.getElementById("adrOut"), "-", "neutral");
  document.getElementById("adrProbOut").textContent = "-";
  document.getElementById("ruleAdrOut").textContent = "-";
  document.getElementById("cleanReviewOut").textContent = "-";

  document.getElementById("symptomsOut").innerHTML =
    '<span class="empty-text">No symptoms detected</span>';

  document.getElementById("riskBadge").textContent = "Low Risk";
  document.getElementById("riskBadge").className = "risk-badge low-risk";
  document.getElementById("riskText").textContent =
    "Risk level will appear here after analysis.";
  document.getElementById("recommendationText").textContent =
    "Recommendation will appear here after analysis.";

  document.getElementById("negBar").style.width = "0%";
  document.getElementById("neuBar").style.width = "0%";
  document.getElementById("posBar").style.width = "0%";

  document.getElementById("negVal").textContent = "0%";
  document.getElementById("neuVal").textContent = "0%";
  document.getElementById("posVal").textContent = "0%";

  if (resultSection) {
    resultSection.classList.add("hidden");
  }
}

function fillSample() {
  if (drugInput) {
    drugInput.value = "Paracetamol";
  }

  if (reviewInput) {
    reviewInput.value =
      "I used Paracetamol for fever and body pain. It worked very fast and I felt relief within a few hours. No side effects for me.";
  }
}

function savePredictionToHistory(data, drugName, riskLabel) {
  const history = JSON.parse(localStorage.getItem("predictionHistory") || "[]");

  const adrPresent =
    data.adr_present_model === 1 || data.adr_present_model === true;

  history.push({
    drugName: data.drug_name || drugName || "-",
    sentiment: data.predicted_sentiment || "-",
    adrLabel: adrPresent ? "Present" : "Not Present",
    adrPresent: adrPresent ? 1 : 0,
    adrProbability: Number(data.adr_probability || 0),
    symptoms: data.detected_symptoms || [],
    risk: riskLabel || "-"
  });

  localStorage.setItem("predictionHistory", JSON.stringify(history));
}

async function analyzeReview() {
  const drug_name = drugInput?.value.trim();
  const review_text = reviewInput?.value.trim();

  if (!drug_name || !review_text) {
    alert("Please enter both drug name and review text.");
    return;
  }

  if (loading) loading.classList.remove("hidden");
  if (resultSection) resultSection.classList.add("hidden");

  try {
    const response = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ drug_name, review_text })
    });

    if (!response.ok) {
      throw new Error("Prediction failed");
    }

    const data = await response.json();

    document.getElementById("drugOut").textContent = data.drug_name || drug_name;

    const sentiment = data.predicted_sentiment || "Neutral";
    if (sentiment === "Negative") {
      setBadgeStyle(document.getElementById("sentimentOut"), sentiment, "negative");
    } else if (sentiment === "Neutral") {
      setBadgeStyle(document.getElementById("sentimentOut"), sentiment, "neutral");
    } else {
      setBadgeStyle(document.getElementById("sentimentOut"), sentiment, "positive");
    }

    const modelAdrPresent = data.adr_present_model === 1 || data.adr_present_model === true;
    const adrText = modelAdrPresent ? "ADR Present" : "No ADR";
    setBadgeStyle(
      document.getElementById("adrOut"),
      adrText,
      modelAdrPresent ? "adr-yes" : "adr-no"
    );

    const adrProbability = Number(data.adr_probability ?? 0);
    document.getElementById("adrProbOut").textContent = adrProbability.toFixed(4);

    document.getElementById("ruleAdrOut").textContent =
      data.adr_present_rule_based === 1 || data.adr_present_rule_based === true ? "Yes" : "No";

    document.getElementById("cleanReviewOut").textContent = data.clean_review || review_text;

    const symptoms = data.detected_symptoms || [];
    renderSymptoms(symptoms);

    const risk = getRiskLevel(
      data.predicted_sentiment,
      data.adr_present_model,
      adrProbability,
      symptoms
    );

    const riskBadge = document.getElementById("riskBadge");
    riskBadge.textContent = risk.label;
    riskBadge.className = `risk-badge ${risk.className}`;
    document.getElementById("riskText").textContent = risk.text;

    const recommendation = getRecommendation(
      data.predicted_sentiment,
      data.adr_present_model,
      symptoms
    );
    document.getElementById("recommendationText").textContent = recommendation;

    const sentimentProb = data.sentiment_probabilities || {};
    const neg = Number(sentimentProb.negative || 0) * 100;
    const neu = Number(sentimentProb.neutral || 0) * 100;
    const pos = Number(sentimentProb.positive || 0) * 100;

    document.getElementById("negBar").style.width = `${neg}%`;
    document.getElementById("neuBar").style.width = `${neu}%`;
    document.getElementById("posBar").style.width = `${pos}%`;

    document.getElementById("negVal").textContent = `${neg.toFixed(2)}%`;
    document.getElementById("neuVal").textContent = `${neu.toFixed(2)}%`;
    document.getElementById("posVal").textContent = `${pos.toFixed(2)}%`;

    savePredictionToHistory(data, drug_name, risk.label);
    analysisHistory = JSON.parse(localStorage.getItem("predictionHistory") || "[]");
    renderHistoryTable();

    if (resultSection) resultSection.classList.remove("hidden");
    showPage("predictionPage");
  } catch (error) {
    alert("Backend is not running or prediction failed.");
    console.error(error);
  } finally {
    if (loading) loading.classList.add("hidden");
  }
}

analyzeBtn?.addEventListener("click", analyzeReview);
clearBtn?.addEventListener("click", clearForm);
sampleBtn?.addEventListener("click", fillSample);

requireLogin();
checkBackend();
renderHistoryTable();
showPage("homePage");