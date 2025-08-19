// Basic SPA for testing prompts against OpenRouter models

(function () {
  const DOM = {
    apiKeyInput: document.getElementById("apiKeyInput"),
    saveKeyBtn: document.getElementById("saveKeyBtn"),
    clearKeyBtn: document.getElementById("clearKeyBtn"),
    modelSelect: document.getElementById("modelSelect"),
    refreshModelsBtn: document.getElementById("refreshModelsBtn"),
    modelHint: document.getElementById("modelHint"),
    promptInput: document.getElementById("promptInput"),
    jobInput: document.getElementById("jobInput"),
    rubricInput: document.getElementById("rubricInput"),
    resumesInput: document.getElementById("resumesInput"),
    seedBtn: document.getElementById("seedBtn"),
    clearBtn: document.getElementById("clearBtn"),
    runBtn: document.getElementById("runBtn"),
    tabText: document.getElementById("tabText"),
    tabJson: document.getElementById("tabJson"),
    panelText: document.getElementById("panelText"),
    panelJson: document.getElementById("panelJson"),
    statusArea: document.getElementById("statusArea"),
    promptTabJob: document.getElementById("promptTabJob"),
    promptTabRubric: document.getElementById("promptTabRubric"),
    promptTabEval: document.getElementById("promptTabEval"),
  };

  const DEFAULT_MODELS = [
    "openrouter/auto",
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-3.5-haiku",
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
    "google/gemini-1.5-flash",
    "google/gemini-1.5-pro",
    "meta-llama/llama-3.1-405b-instruct",
    "mistralai/mixtral-8x7b-instruct",
  ];

  const STORAGE_KEYS = {
    apiKey: "openrouter_api_key",
    lastModel: "openrouter_last_model",
    prompt: "openrouter_prompt_text", // fallback / legacy
    promptByType: (type) => `openrouter_prompt_text_${type}`,
    activePromptType: "openrouter_active_prompt_type",
    job: "openrouter_job_text",
    rubric: "openrouter_rubric_text",
    resumes: "openrouter_resumes_text",
    lastOutputText: "openrouter_last_output_text",
    lastOutputJson: "openrouter_last_output_json",
    activeTab: "openrouter_active_tab",
  };

  const PROMPT_TYPES = {
    job: "job",
    rubric: "rubric",
    eval: "eval",
  };

  function getActivePromptType() {
    const saved = readLocal(STORAGE_KEYS.activePromptType, PROMPT_TYPES.eval);
    if (
      [PROMPT_TYPES.job, PROMPT_TYPES.rubric, PROMPT_TYPES.eval].includes(saved)
    )
      return saved;
    return PROMPT_TYPES.eval;
  }

  function setActivePromptType(type) {
    saveLocal(STORAGE_KEYS.activePromptType, type);
  }

  function updatePromptTabsUI(active) {
    const map = {
      [PROMPT_TYPES.job]: DOM.promptTabJob,
      [PROMPT_TYPES.rubric]: DOM.promptTabRubric,
      [PROMPT_TYPES.eval]: DOM.promptTabEval,
    };
    Object.entries(map).forEach(([key, el]) => {
      const isActive = key === active;
      el.classList.toggle("active", isActive);
      el.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  function loadPromptForType(type) {
    const key = STORAGE_KEYS.promptByType(type);
    const fallback = readLocal(STORAGE_KEYS.prompt, "");
    const text = readLocal(key, fallback);
    DOM.promptInput.value = text;
  }

  function savePromptForType(type, value) {
    saveLocal(STORAGE_KEYS.promptByType(type), value);
  }

  function setStatus(message, type) {
    DOM.statusArea.textContent = message;
    DOM.statusArea.style.color =
      type === "error" ? "#ef4444" : type === "success" ? "#22c55e" : "#8b95a7";
  }

  function saveLocal(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  }

  function readLocal(key, fallback = "") {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch (e) {
      return fallback;
    }
  }

  function populateModels(models) {
    DOM.modelSelect.innerHTML = "";
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m.id || m; // API returns objects; fallback to string list
      opt.textContent = m.name || m; // show name if present
      DOM.modelSelect.appendChild(opt);
    }
    const last = readLocal(STORAGE_KEYS.lastModel);
    if (last) {
      DOM.modelSelect.value = last;
    }
  }

  async function fetchModels() {
    const apiKey =
      DOM.apiKeyInput.value.trim() || readLocal(STORAGE_KEYS.apiKey);
    const headers = {
      "Content-Type": "application/json",
      "X-Title": "OpenRouter Prompt Tester",
    };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    try {
      setStatus("Loading models...", "");
      const resp = await fetch("https://openrouter.ai/api/v1/models", {
        headers,
      });
      if (!resp.ok) throw new Error(`Failed to load models (${resp.status})`);
      const data = await resp.json();
      const models = Array.isArray(data.data)
        ? data.data.map((m) => ({ id: m.id, name: m.name || m.id }))
        : DEFAULT_MODELS;
      populateModels(models);
      setStatus(`Loaded ${models.length} models`, "success");
      DOM.modelHint.textContent = "Loaded from OpenRouter";
    } catch (err) {
      populateModels(DEFAULT_MODELS);
      setStatus("Using fallback models", "error");
      DOM.modelHint.textContent =
        "Using fallback list (set API key and refresh for full list)";
    }
  }

  function buildUserContent(prompt, job, rubric, resumes) {
    const parts = [];
    if (prompt) parts.push(prompt);
    if (job) parts.push(`\n\nJob Description:\n${job}`);
    if (rubric) parts.push(`\n\nRubric:\n${rubric}`);
    if (resumes) parts.push(`\n\nResumes:\n${resumes}`);
    return parts.join("\n");
  }

  async function runPrompt() {
    const apiKey =
      DOM.apiKeyInput.value.trim() || readLocal(STORAGE_KEYS.apiKey);
    if (!apiKey) {
      alert("Please enter your OpenRouter API key.");
      return;
    }

    const model = DOM.modelSelect.value;
    const prompt = DOM.promptInput.value;
    const job = DOM.jobInput.value;
    const rubric = DOM.rubricInput.value;
    const resumes = DOM.resumesInput.value;

    saveLocal(STORAGE_KEYS.lastModel, model);
    // Persist per active prompt type
    const activeType = getActivePromptType();
    savePromptForType(activeType, prompt);
    saveLocal(STORAGE_KEYS.job, job);
    saveLocal(STORAGE_KEYS.rubric, rubric);
    saveLocal(STORAGE_KEYS.resumes, resumes);

    const content = buildUserContent(prompt, job, rubric, resumes);

    const body = {
      model,
      messages: [{ role: "user", content }],
    };

    DOM.runBtn.disabled = true;
    setStatus("Running...", "");
    DOM.panelText.textContent = "";
    DOM.panelJson.textContent = "";

    try {
      const resp = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "X-Title": "OpenRouter Prompt Tester",
          },
          body: JSON.stringify(body),
        }
      );

      const raw = await resp.text();
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (_) {}

      if (!resp.ok) {
        setStatus(`Error ${resp.status}`, "error");
      } else {
        setStatus("Success", "success");
      }

      // Text extraction
      let textOut = "";
      if (parsed && parsed.choices && parsed.choices.length > 0) {
        // OpenRouter mostly follows OpenAI format
        const msg = parsed.choices[0].message;
        if (msg && typeof msg.content === "string") textOut = msg.content;
        // Sometimes content can be array of parts
        if (Array.isArray(msg?.content)) {
          textOut = msg.content
            .map((p) => (typeof p === "string" ? p : p.text || p.content || ""))
            .join("");
        }
      }

      DOM.panelText.textContent = textOut || raw;
      DOM.panelJson.textContent = parsed
        ? JSON.stringify(parsed, null, 2)
        : raw;
      saveLocal(STORAGE_KEYS.lastOutputText, DOM.panelText.textContent);
      saveLocal(STORAGE_KEYS.lastOutputJson, DOM.panelJson.textContent);
    } catch (err) {
      setStatus("Network error", "error");
      const msg = err && err.message ? err.message : String(err);
      DOM.panelText.textContent = msg;
      DOM.panelJson.textContent = msg;
    } finally {
      DOM.runBtn.disabled = false;
    }
  }

  function seedPrompt() {
    const type = getActivePromptType();
    let seed = "";
    if (type === PROMPT_TYPES.job) {
      seed = `You are a parser that extracts structured fields from a job description.\n\nTask:\n- Identify title, location, seniority, required skills, nice-to-have skills, responsibilities, compensation (if present).\n- Return strictly valid JSON.\n\nReturn format:\n{\n  "title": "",\n  "location": "",\n  "seniority": "",\n  "required_skills": [],\n  "nice_to_have_skills": [],\n  "responsibilities": [],\n  "compensation": {"currency": "", "min": null, "max": null, "period": ""}\n}`;
    } else if (type === PROMPT_TYPES.rubric) {
      seed = `You are an expert hiring rubric designer. Given a job description, create a concise scoring rubric.\n\nInstructions:\n- Create 5-8 rubric items.\n- Each item has a name, description, and weight (sum to 100).\n- Focus on signals that correlate with job performance.\n\nReturn format (JSON):\n{\n  "rubric": [\n    {"name": "", "description": "", "weight": 0}\n  ]\n}`;
    } else {
      seed = `You are a helpful AI assistant that evaluates candidates against a rubric for a given job.\n\nInstructions:\n- Read the job description.\n- Score each resume against the rubric.\n- Provide a brief justification for each score.\n- Return a final summary ranking candidates.\n\nReturn format:\n- JSON with fields: candidate_id, scores { rubric_item: number }, notes, final_rank.`;
    }
    DOM.promptInput.value = seed;
    savePromptForType(type, seed);
  }

  function clearAll() {
    DOM.promptInput.value = "";
    DOM.jobInput.value = "";
    DOM.rubricInput.value = "";
    DOM.resumesInput.value = "";
    DOM.panelText.textContent = "";
    DOM.panelJson.textContent = "";
    setStatus("Cleared", "");
  }

  function attachOutputTabs() {
    function activate(which) {
      const isText = which === "text";
      DOM.tabText.classList.toggle("active", isText);
      DOM.tabJson.classList.toggle("active", !isText);
      DOM.panelText.classList.toggle("hidden", !isText);
      DOM.panelJson.classList.toggle("hidden", isText);
      saveLocal(STORAGE_KEYS.activeTab, which);
    }
    DOM.tabText.addEventListener("click", () => activate("text"));
    DOM.tabJson.addEventListener("click", () => activate("json"));
    const last = readLocal(STORAGE_KEYS.activeTab, "text");
    activate(last);
  }

  function loadSavedInputs() {
    const savedKey = readLocal(STORAGE_KEYS.apiKey);
    if (savedKey && !DOM.apiKeyInput.value) {
      DOM.apiKeyInput.value = savedKey;
    }
    // Prompt text is per prompt-type; load selected type below
    DOM.jobInput.value = readLocal(STORAGE_KEYS.job);
    DOM.rubricInput.value = readLocal(STORAGE_KEYS.rubric);
    DOM.resumesInput.value = readLocal(STORAGE_KEYS.resumes);
    DOM.panelText.textContent = readLocal(STORAGE_KEYS.lastOutputText);
    DOM.panelJson.textContent = readLocal(STORAGE_KEYS.lastOutputJson);
  }

  function wireHandlers() {
    DOM.saveKeyBtn.addEventListener("click", () => {
      const val = DOM.apiKeyInput.value.trim();
      if (!val) {
        alert("Enter an API key first.");
        return;
      }
      saveLocal(STORAGE_KEYS.apiKey, val);
      setStatus("API key saved locally", "success");
    });
    DOM.clearKeyBtn.addEventListener("click", () => {
      try {
        localStorage.removeItem(STORAGE_KEYS.apiKey);
      } catch (e) {}
      DOM.apiKeyInput.value = "";
      setStatus("API key cleared", "");
    });
    DOM.refreshModelsBtn.addEventListener("click", fetchModels);
    DOM.runBtn.addEventListener("click", runPrompt);
    DOM.seedBtn.addEventListener("click", seedPrompt);
    DOM.clearBtn.addEventListener("click", clearAll);

    // Autosave inputs
    const autosave = (key) => (e) => saveLocal(key, e.target.value);
    // Prompt autosave should be per prompt type
    DOM.promptInput.addEventListener("input", () => {
      savePromptForType(getActivePromptType(), DOM.promptInput.value);
    });
    DOM.jobInput.addEventListener("input", autosave(STORAGE_KEYS.job));
    DOM.rubricInput.addEventListener("input", autosave(STORAGE_KEYS.rubric));
    DOM.resumesInput.addEventListener("input", autosave(STORAGE_KEYS.resumes));
    DOM.modelSelect.addEventListener("change", () =>
      saveLocal(STORAGE_KEYS.lastModel, DOM.modelSelect.value)
    );
  }

  // Init
  attachOutputTabs();
  loadSavedInputs();
  // Initialize prompt type tabs and load content
  const initialType = getActivePromptType();
  updatePromptTabsUI(initialType);
  loadPromptForType(initialType);
  // Wire prompt-type tab clicks
  DOM.promptTabJob.addEventListener("click", () => {
    setActivePromptType(PROMPT_TYPES.job);
    updatePromptTabsUI(PROMPT_TYPES.job);
    loadPromptForType(PROMPT_TYPES.job);
  });
  DOM.promptTabRubric.addEventListener("click", () => {
    setActivePromptType(PROMPT_TYPES.rubric);
    updatePromptTabsUI(PROMPT_TYPES.rubric);
    loadPromptForType(PROMPT_TYPES.rubric);
  });
  DOM.promptTabEval.addEventListener("click", () => {
    setActivePromptType(PROMPT_TYPES.eval);
    updatePromptTabsUI(PROMPT_TYPES.eval);
    loadPromptForType(PROMPT_TYPES.eval);
  });

  wireHandlers();
  fetchModels();
})();
