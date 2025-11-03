document.addEventListener("DOMContentLoaded", () => {
  let scenarioState = {
    meta: {
      id: "",
      title: "",
      description: "",
      author: "",
      start_dialogue: "start",
    },
    dialogues: {
      start: { text: "", scene: "" },
    },
  };

  const charactersData = JSON.parse(
    document.getElementById("characters-data").textContent,
  );
  const scenesData = JSON.parse(
    document.getElementById("scenes-data").textContent,
  );
  const bgmData = JSON.parse(document.getElementById("bgm-data").textContent);
  const sfxData = JSON.parse(document.getElementById("sfx-data").textContent);

  const addDialogueBtn = document.getElementById("add-dialogue-btn");
  const saveScenarioBtn = document.getElementById("save-scenario-btn");
  const loadScenarioSelect = document.getElementById("load-scenario-select");
  const loadScenarioBtn = document.getElementById("load-scenario-btn");
  const newScenarioBtn = document.getElementById("new-scenario-btn");
  const exportScenarioBtn = document.getElementById("export-scenario-btn");
  const importScenarioBtn = document.getElementById("import-scenario-btn");
  const importScenarioInput = document.getElementById("import-scenario-input");
  const cardsContainer = document.getElementById("dialogue-cards-container");
  const cardTemplate = document.getElementById("dialogue-card-template");
  const choiceTemplate = document.getElementById("choice-row-template");

  const previewPlayer = new Audio();
  let currentPreviewButton = null;

  const resetPreviewButton = () => {
    if (currentPreviewButton) {
      currentPreviewButton.textContent = "▶";
      currentPreviewButton = null;
    }
  };

  const updatePreviewButtonState = (selectElement) => {
    const wrapper = selectElement.closest(".audio-control-wrapper");
    const button = wrapper.querySelector(".audio-preview-btn");
    const hasValue = selectElement.value && selectElement.value !== "stop";

    if (hasValue) {
      button.disabled = false;
      button.classList.remove("btn--disabled");
      button.classList.add("btn--secondary");
    } else {
      button.disabled = true;
      button.classList.remove("btn--secondary");
      button.classList.add("btn--disabled");
    }
  };

  previewPlayer.addEventListener("pause", resetPreviewButton);
  previewPlayer.addEventListener("ended", resetPreviewButton);

  function renderAll() {
    document.getElementById("scenario-id").value = scenarioState.meta.id || "";
    document.getElementById("scenario-title").value =
      scenarioState.meta.title || "";
    document.getElementById("scenario-description").value =
      scenarioState.meta.description || "";
    document.getElementById("scenario-author").value =
      scenarioState.meta.author || "";

    cardsContainer.innerHTML = "";
    const dialogueIds = Object.keys(scenarioState.dialogues);

    for (const dialogueId of dialogueIds) {
      const cardNode = createDialogueCard(
        dialogueId,
        scenarioState.dialogues[dialogueId],
      );
      cardsContainer.appendChild(cardNode);
    }

    updateAllNextDialogueDropdowns();
  }

  function createDialogueCard(id, data) {
    const card = cardTemplate.content.cloneNode(true).firstElementChild;
    card.dataset.id = id;

    const idInput = card.querySelector(".dialogue-id-input");
    card.querySelector(".dialogue-id-display").textContent = id;
    idInput.value = id;
    card.querySelector(".dialogue-text-input").value = data.text || "";

    if (id === "start") {
      idInput.disabled = true;
      const removeButton = card.querySelector(".remove-dialogue-btn");
      if (removeButton) {
        removeButton.remove();
      }
    }

    const sceneSelect = card.querySelector(".scene-select");
    for (const sceneId in scenesData) {
      const option = new Option(scenesData[sceneId].name, sceneId);
      sceneSelect.appendChild(option);
    }
    sceneSelect.value = data.scene || "";

    const slotsContainer = card.querySelector(".characters-slots-container");
    populateCharacterSlots(slotsContainer, data.characters_on_screen || []);

    populateSpeakerDropdown(
      card.querySelector(".speaker-select"),
      data.characters_on_screen || [],
      data.character,
    );

    const choicesContainer = card.querySelector(".choices-container");
    if (data.choices) {
      data.choices.forEach((choice) => {
        const choiceRow = createChoiceRow(
          choice.text,
          choice.next,
          choice.condition,
          choice.set,
        );
        choicesContainer.appendChild(choiceRow);
      });
    }

    // Handle condition input if it exists (from variables system)
    const conditionInput = card.querySelector(".dialogue-condition-input");
    if (conditionInput) {
      conditionInput.value = data.condition || "";
    }

    const bgmSelect = card.querySelector(".bgm-select");
    bgmData.forEach((path) => {
      const fileName = path.split("/").pop();
      const option = new Option(fileName, path);
      bgmSelect.appendChild(option);
    });
    bgmSelect.value = data.bgm || "";
    updatePreviewButtonState(bgmSelect);

    const sfxSelect = card.querySelector(".sfx-select");
    sfxData.forEach((path) => {
      const fileName = path.split("/").pop();
      const option = new Option(fileName, path);
      sfxSelect.appendChild(option);
    });
    sfxSelect.value = data.sfx || "";
    updatePreviewButtonState(sfxSelect);

    return card;
  }

  function createChoiceRow(
    text = "",
    next = "",
    condition = "",
    setObj = null,
  ) {
    const row = choiceTemplate.content.cloneNode(true).firstElementChild;
    row.querySelector(".choice-text-input").value = text;

    // Handle condition input if it exists
    const conditionInput = row.querySelector(".choice-condition-input");
    if (conditionInput) {
      conditionInput.value = condition || "";
    }

    // Handle set input if it exists
    const setInput = row.querySelector(".choice-set-input");
    if (setInput) {
      let setString = "";
      if (setObj) {
        setString = Object.entries(setObj)
          .map(([key, value]) => `${key}=${value}`)
          .join(", ");
      }
      setInput.value = setString;
    }

    return row;
  }

  function populateCharacterSlots(slotsContainer, charactersOnScreen) {
    // Clear existing slots
    slotsContainer.innerHTML = "";

    // Add slots for existing characters
    charactersOnScreen.forEach((charData, index) => {
      addCharacterSlot(slotsContainer, charData, index + 1);
    });

    // Always have at least one empty slot
    if (charactersOnScreen.length === 0) {
      addCharacterSlot(slotsContainer, null, 1);
    }

    // Update all dropdowns after all slots are created
    updateAllCharacterDropdowns(slotsContainer);

    // Update position button states
    updatePositionButtons(slotsContainer);
  }

  function addCharacterSlot(container, charData = null, slotNumber = null) {
    const slotTemplate = document.getElementById("character-slot-template");
    const slot = slotTemplate.content.cloneNode(true).firstElementChild;

    if (slotNumber === null) {
      slotNumber = container.children.length + 1;
    }

    slot.querySelector(".slot-number").textContent = slotNumber;

    const charSelect = slot.querySelector(".character-select");
    const poseSelect = slot.querySelector(".pose-select");

    // Populate character dropdown excluding already selected characters
    populateCharacterDropdown(
      charSelect,
      container,
      charData ? charData.id : null,
    );

    // Set values if character data provided
    if (charData) {
      charSelect.value = charData.id;
      populatePoseDropdown(poseSelect, charData.id, charData.pose);
    }

    container.appendChild(slot);
    updateSlotNumbers(container);

    // Add event listener for character selection changes
    charSelect.addEventListener("change", () => {
      updateAllCharacterDropdowns(container);
    });

    // Set up up/down button event listeners
    setupPositionButtons(slot, container);
  }

  function populateCharacterDropdown(
    charSelect,
    container,
    currentCharId = null,
  ) {
    // Get already selected character IDs (excluding the current one)
    const selectedCharIds = new Set();
    container.querySelectorAll(".character-select").forEach((select) => {
      if (select !== charSelect && select.value) {
        selectedCharIds.add(select.value);
      }
    });

    // Clear and repopulate dropdown
    charSelect.innerHTML = '<option value="">-- Нет --</option>';

    for (const charId in charactersData) {
      // Only add if not already selected by another slot
      if (!selectedCharIds.has(charId) || charId === currentCharId) {
        const option = new Option(charactersData[charId].name, charId);
        charSelect.appendChild(option);
      }
    }
  }

  function updateAllCharacterDropdowns(container) {
    // Update all dropdowns in the container to reflect current selections
    container.querySelectorAll(".character-slot").forEach((slot) => {
      const charSelect = slot.querySelector(".character-select");
      const currentValue = charSelect.value;
      populateCharacterDropdown(charSelect, container, currentValue);
      charSelect.value = currentValue; // Restore selection
    });
  }

  function updateSlotNumbers(container) {
    const slots = container.querySelectorAll(".character-slot");
    slots.forEach((slot, index) => {
      slot.querySelector(".slot-number").textContent = index + 1;
    });
  }

  function populatePoseDropdown(select, charId, selectedPose) {
    select.innerHTML = "";
    if (charId && charactersData[charId]) {
      for (const poseId in charactersData[charId].poses) {
        const option = new Option(poseId, poseId);
        select.appendChild(option);
      }
      select.value = selectedPose || "neutral";
    }
  }

  function populateSpeakerDropdown(
    select,
    charactersOnScreen,
    selectedSpeaker,
  ) {
    select.innerHTML = '<option value="">-- Рассказчик --</option>';
    charactersOnScreen.forEach((char) => {
      const charName = charactersData[char.id]?.name || char.id;
      const option = new Option(charName, char.id);
      select.appendChild(option);
    });
    select.value = selectedSpeaker || "";
  }

  function updateAllNextDialogueDropdowns() {
    const dialogueIds = Object.keys(scenarioState.dialogues);
    const allSelects = document.querySelectorAll(
      ".next-dialogue-select, .choice-next-select, .next-if-false-select",
    );

    allSelects.forEach((select) => {
      const currentValue = select.value;
      select.innerHTML = "";

      if (select.classList.contains("next-if-false-select")) {
        select.add(new Option("-- Перейти к 'ID Следующей реплики' --", ""));
      } else {
        select.add(new Option("-- Не выбрано --", ""));
      }

      dialogueIds.forEach((id) => {
        select.add(new Option(id, id));
      });

      if (dialogueIds.includes(currentValue) || currentValue === "") {
        select.value = currentValue;
      } else {
        select.value = "";
      }
    });

    document.querySelectorAll(".dialogue-card").forEach((card) => {
      const cardId = card.dataset.id;
      const cardData = scenarioState.dialogues[cardId];
      if (cardData) {
        card.querySelector(".next-dialogue-select").value = cardData.next || "";

        // Handle next-if-false select if it exists
        const nextIfFalseSelect = card.querySelector(".next-if-false-select");
        if (nextIfFalseSelect) {
          nextIfFalseSelect.value = cardData.next_if_false || "";
        }
        card.querySelectorAll(".choice-row").forEach((row, index) => {
          if (cardData.choices && cardData.choices[index]) {
            row.querySelector(".choice-next-select").value =
              cardData.choices[index].next || "";
          }
        });
      }
    });
  }

  function setupPositionButtons(slot, container) {
    const moveUpBtn = slot.querySelector(".move-up-btn");
    const moveDownBtn = slot.querySelector(".move-down-btn");

    moveUpBtn.addEventListener("click", (e) => {
      e.preventDefault();
      moveSlotUp(slot, container);
    });

    moveDownBtn.addEventListener("click", (e) => {
      e.preventDefault();
      moveSlotDown(slot, container);
    });
  }

  function moveSlotUp(slot, container) {
    const previousSlot = slot.previousElementSibling;
    if (previousSlot) {
      container.insertBefore(slot, previousSlot);
      updateSlotNumbers(container);
      updateCharactersOnScreenFromSlots(container);
      updatePositionButtons(container);
    }
  }

  function moveSlotDown(slot, container) {
    const nextSlot = slot.nextElementSibling;
    if (nextSlot) {
      container.insertBefore(nextSlot, slot);
      updateSlotNumbers(container);
      updateCharactersOnScreenFromSlots(container);
      updatePositionButtons(container);
    }
  }

  function updatePositionButtons(container) {
    const slots = container.querySelectorAll(".character-slot");
    slots.forEach((slot, index) => {
      const moveUpBtn = slot.querySelector(".move-up-btn");
      const moveDownBtn = slot.querySelector(".move-down-btn");

      // Disable up button for first slot
      moveUpBtn.disabled = index === 0;
      // Disable down button for last slot
      moveDownBtn.disabled = index === slots.length - 1;
    });
  }

  function updateCharactersOnScreenFromSlots(container) {
    const card = container.closest(".dialogue-card");
    const dialogueId = card.dataset.id;
    const dialogue = scenarioState.dialogues[dialogueId];

    const charactersOnScreen = [];
    container.querySelectorAll(".character-slot").forEach((slot) => {
      const charId = slot.querySelector(".character-select").value;
      if (charId) {
        charactersOnScreen.push({
          id: charId,
          pose: slot.querySelector(".pose-select").value || "neutral",
        });
      }
    });

    dialogue.characters_on_screen = charactersOnScreen;

    // Update speaker dropdown to reflect new order
    populateSpeakerDropdown(
      card.querySelector(".speaker-select"),
      charactersOnScreen,
      dialogue.character,
    );
  }

  function handleStateUpdate(e) {
    const target = e.target;

    function sanitizeId(value) {
      if (!value) return "";
      return value
        .toLowerCase()
        .replace(/[\s-]+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
    }

    if (target.id.startsWith("scenario-")) {
      const metaKey = target.id.replace("scenario-", "");

      if (target.id === "scenario-id") {
        const sanitizedValue = sanitizeId(target.value);
        if (target.value !== sanitizedValue) {
          target.value = sanitizedValue;
        }
        scenarioState.meta.id = sanitizedValue;
      } else {
        scenarioState.meta[metaKey] = target.value;
      }
      return;
    }

    const card = target.closest(".dialogue-card");
    if (!card) return;
    const dialogueId = card.dataset.id;
    const dialogue = scenarioState.dialogues[dialogueId];
    if (!dialogue) return;

    if (target.classList.contains("dialogue-id-input")) {
      const sanitizedValue = sanitizeId(target.value);
      if (target.value !== sanitizedValue) {
        target.value = sanitizedValue;
      }
      const newId = sanitizedValue;

      if (newId && newId !== dialogueId && !scenarioState.dialogues[newId]) {
        const oldData = scenarioState.dialogues[dialogueId];
        delete scenarioState.dialogues[dialogueId];
        scenarioState.dialogues[newId] = oldData;
        card.dataset.id = newId;
        card.querySelector(".dialogue-id-display").textContent = newId;
        updateAllNextDialogueDropdowns();
      } else if (newId !== dialogueId && scenarioState.dialogues[newId]) {
        target.value = dialogueId;
      }
      return;
    }

    if (target.classList.contains("dialogue-text-input"))
      dialogue.text = target.value;
    if (target.classList.contains("speaker-select"))
      dialogue.character = target.value || null;
    if (target.classList.contains("next-dialogue-select"))
      dialogue.next = target.value || null;
    if (target.classList.contains("scene-select"))
      dialogue.scene = target.value || undefined;
    if (target.classList.contains("bgm-select")) {
      dialogue.bgm = target.value || undefined;
      updatePreviewButtonState(target);
    }
    if (target.classList.contains("sfx-select")) {
      dialogue.sfx = target.value || undefined;
      updatePreviewButtonState(target);
    }
    if (target.classList.contains("dialogue-condition-input"))
      dialogue.condition = target.value || undefined;
    if (target.classList.contains("next-if-false-select"))
      dialogue.next_if_false = target.value || undefined;

    if (target.matches(".character-select, .pose-select")) {
      const charactersOnScreen = [];
      card.querySelectorAll(".character-slot").forEach((slot) => {
        const charId = slot.querySelector(".character-select").value;
        if (charId) {
          charactersOnScreen.push({
            id: charId,
            pose: slot.querySelector(".pose-select").value || "neutral",
          });
        }
      });
      dialogue.characters_on_screen = charactersOnScreen;

      if (target.classList.contains("character-select")) {
        const slot = target.closest(".character-slot");
        const slotsContainer = slot.parentElement;
        const poseSelect = slot.querySelector(".pose-select");

        populatePoseDropdown(poseSelect, target.value);
        populateSpeakerDropdown(
          card.querySelector(".speaker-select"),
          charactersOnScreen,
          dialogue.character,
        );

        // Update all character dropdowns to reflect the new selection
        updateAllCharacterDropdowns(slotsContainer);
      }
    }

    if (
      target.matches(
        ".choice-text-input, .choice-next-select, .choice-condition-input, .choice-set-input",
      )
    ) {
      const choices = [];
      card.querySelectorAll(".choice-row").forEach((row) => {
        const text = row.querySelector(".choice-text-input").value;
        if (text) {
          const choice = {
            text,
            next: row.querySelector(".choice-next-select").value || null,
            condition:
              row.querySelector(".choice-condition-input").value || undefined,
          };

          const setString = row.querySelector(".choice-set-input").value;
          if (setString) {
            const setObj = {};
            setString.split(",").forEach((pair) => {
              const parts = pair.split("=").map((p) => p.trim());
              if (parts.length === 2) {
                let value = parts[1];
                if (value.toLowerCase() === "true") value = true;
                else if (value.toLowerCase() === "false") value = false;
                else if (
                  !isNaN(parseFloat(value)) &&
                  !value.startsWith("+") &&
                  !value.startsWith("-")
                )
                  value = parseFloat(value);
                setObj[parts[0]] = value;
              }
            });
            choice.set = setObj;
          }
          choices.push(choice);
        }
      });
      dialogue.choices = choices.length > 0 ? choices : undefined;
      if (dialogue.choices) {
        dialogue.next = null;
        card.querySelector(".next-dialogue-select").value = "";
        card.querySelector(".next-dialogue-select").disabled = true;
      } else {
        card.querySelector(".next-dialogue-select").disabled = false;
      }
    }
  }

  function handleClicks(e) {
    const target = e.target;

    if (target.classList.contains("audio-preview-btn")) {
      e.preventDefault();
      const wrapper = target.closest(".audio-control-wrapper");
      const select = wrapper.querySelector("select");
      const selectedAudio = select.value;

      if (target === currentPreviewButton && !previewPlayer.paused) {
        previewPlayer.pause();
        return;
      }

      previewPlayer.pause();

      if (selectedAudio && selectedAudio !== "stop") {
        previewPlayer.src = selectedAudio;
        previewPlayer.play();
        currentPreviewButton = target;
        target.textContent = "❚❚";
      }
      return;
    }

    if (target.classList.contains("remove-dialogue-btn")) {
      const dialogueCard = target.closest(".dialogue-card");
      if (dialogueCard) {
        const dialogueId = dialogueCard.dataset.id;
        if (dialogueId === "start") {
          alert('Нельзя удалить стартовую реплику "start".');
          return;
        }
        if (
          confirm(`Вы уверены, что хотите удалить реплику "${dialogueId}"?`)
        ) {
          delete scenarioState.dialogues[dialogueId];
          renderAll();
        }
      }
      return;
    }

    if (target.matches(".remove-btn") && target.closest(".choice-row")) {
      const choiceRow = target.closest(".choice-row");
      const dialogueCard = choiceRow.closest(".dialogue-card");
      choiceRow.remove();
      handleStateUpdate({
        target: dialogueCard.querySelector(".choices-container"),
      });
      return;
    }

    if (target.classList.contains("add-choice-btn")) {
      const card = target.closest(".dialogue-card");
      const choicesContainer = card.querySelector(".choices-container");
      const choiceRow = createChoiceRow();
      choicesContainer.appendChild(choiceRow);
      updateAllNextDialogueDropdowns();
      handleStateUpdate({ target: choicesContainer });
      return;
    }

    if (target.classList.contains("add-character-btn")) {
      const card = target.closest(".dialogue-card");
      const slotsContainer = card.querySelector(".characters-slots-container");
      addCharacterSlot(slotsContainer);
      updatePositionButtons(slotsContainer);
      return;
    }

    if (target.classList.contains("remove-character-btn")) {
      const slot = target.closest(".character-slot");
      const slotsContainer = slot.parentElement;
      const card = target.closest(".dialogue-card");

      slot.remove();
      updateSlotNumbers(slotsContainer);

      // Update all character dropdowns after removal
      updateAllCharacterDropdowns(slotsContainer);

      // Update state
      const charactersOnScreen = [];
      card.querySelectorAll(".character-slot").forEach((slot) => {
        const charId = slot.querySelector(".character-select").value;
        if (charId) {
          charactersOnScreen.push({
            id: charId,
            pose: slot.querySelector(".pose-select").value || "neutral",
          });
        }
      });
      const dialogueId = card.dataset.id;
      scenarioState.dialogues[dialogueId].characters_on_screen =
        charactersOnScreen;

      // Update speaker dropdown
      populateSpeakerDropdown(
        card.querySelector(".speaker-select"),
        charactersOnScreen,
        scenarioState.dialogues[dialogueId].character,
      );

      // Update position buttons
      updatePositionButtons(slotsContainer);
      return;
    }
  }

  addDialogueBtn.addEventListener("click", () => {
    const newId = `dialogue_${Date.now()}`;
    if (scenarioState.dialogues[newId]) return;

    scenarioState.dialogues[newId] = { text: "", scene: "" };
    renderAll();

    const newCard = document.querySelector(`[data-id="${newId}"]`);
    if (newCard) {
      newCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  async function saveScenario() {
    if (!scenarioState.meta.id) {
      notifications.error(
        "Необходимые данные",
        "Пожалуйста, укажите ID сценария!",
      );
      return;
    }

    const finalJson = {
      scenarios: {
        [scenarioState.meta.id]: {
          title: scenarioState.meta.title,
          description: scenarioState.meta.description,
          author: scenarioState.meta.author,
          start_dialogue: scenarioState.meta.start_dialogue,
          dialogues: scenarioState.dialogues,
        },
      },
    };

    try {
      const response = await fetch("/api/scenarios/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(finalJson),
      });

      const result = await response.json();

      if (result.success) {
        notifications.success("Успешно", result.message);
        await loadScenariosList();
      } else if (result.requires_auth) {
        // Authentication required - prompt for login
        const authenticated = await auth.ensureAuthenticated();
        if (authenticated) {
          // Retry the save operation
          await saveScenario();
          return;
        }
      } else {
        notifications.error("Ошибка сохранения", result.error);
      }
    } catch (error) {
      console.error("Error saving scenario:", error);
      notifications.error("Ошибка сохранения", "Не удалось сохранить сценарий");
    }
  }

  saveScenarioBtn.addEventListener("click", saveScenario);

  async function loadScenariosList() {
    try {
      const response = await fetch("/api/scenarios/list");
      const result = await response.json();

      if (result.scenarios) {
        loadScenarioSelect.innerHTML =
          '<option value="">-- Загрузить сценарий --</option>';

        result.scenarios.forEach((scenario) => {
          const option = new Option(
            `${scenario.title || scenario.id} (ID: ${scenario.id})`,
            scenario.id,
          );
          loadScenarioSelect.appendChild(option);
        });
      }
    } catch (error) {
      console.error("Error loading scenarios list:", error);
    }
  }

  async function loadScenario(scenarioId) {
    try {
      const response = await fetch(`/api/scenarios/load/${scenarioId}`);
      const data = await response.json();

      if (data.error) {
        notifications.error("Ошибка загрузки", data.error);
        return;
      }

      if (!data.scenarios) {
        notifications.error("Ошибка данных", "Неверный формат данных");
        return;
      }

      const loadedScenario = data.scenarios[scenarioId];
      if (!loadedScenario) {
        notifications.error("Ошибка загрузки", "Сценарий не найден");
        return;
      }

      scenarioState.meta.id = scenarioId;
      scenarioState.meta.title = loadedScenario.title || "";
      scenarioState.meta.description = loadedScenario.description || "";
      scenarioState.meta.author = loadedScenario.author || "";
      scenarioState.meta.start_dialogue =
        loadedScenario.start_dialogue || "start";
      scenarioState.dialogues = loadedScenario.dialogues || {
        start: { text: "", scene: "" },
      };

      renderAll();
      notifications.success("Загрузка завершена", "Сценарий загружен успешно!");
    } catch (error) {
      console.error("Error loading scenario:", error);
      notifications.error("Ошибка загрузки", "Не удалось загрузить сценарий");
    }
  }

  async function createNewScenario() {
    const shouldCreate = await notifications.confirm(
      "Новый сценарий",
      "Создать новый сценарий?\n\nНесохранённые изменения будут потеряны.",
    );
    if (shouldCreate) {
      scenarioState = {
        meta: {
          id: "",
          title: "",
          description: "",
          author: "",
          start_dialogue: "start",
        },
        dialogues: {
          start: { text: "", scene: "" },
        },
      };
      renderAll();
    }
  }

  loadScenarioBtn.addEventListener("click", () => {
    const selectedScenario = loadScenarioSelect.value;
    if (selectedScenario) {
      loadScenario(selectedScenario);
    } else {
      notifications.warning(
        "Выбор сценария",
        "Пожалуйста, выберите сценарий для загрузки.",
      );
    }
  });

  function exportScenario() {
    if (!scenarioState.meta.id) {
      notifications.error(
        "Необходимые данные",
        "Пожалуйста, укажите ID сценария перед экспортом!",
      );
      return;
    }

    const finalJson = {
      scenarios: {
        [scenarioState.meta.id]: {
          title: scenarioState.meta.title,
          description: scenarioState.meta.description,
          author: scenarioState.meta.author,
          start_dialogue: scenarioState.meta.start_dialogue,
          dialogues: scenarioState.dialogues,
        },
      },
    };

    const jsonString = JSON.stringify(finalJson, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${scenarioState.meta.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    notifications.success(
      "Экспорт завершён",
      `Файл ${scenarioState.meta.id}.json скачан успешно`,
    );
  }

  function importScenario(file) {
    const reader = new FileReader();
    reader.onload = async function (e) {
      try {
        const data = JSON.parse(e.target.result);

        if (!data.scenarios) {
          throw new Error(
            'Неверный формат файла. Отсутствует секция "scenarios".',
          );
        }

        const scenarioIds = Object.keys(data.scenarios);
        if (scenarioIds.length === 0) {
          throw new Error("Файл не содержит сценариев.");
        }

        const scenarioId = scenarioIds[0];
        const loadedScenario = data.scenarios[scenarioId];
        if (
          scenarioState.meta.id ||
          Object.keys(scenarioState.dialogues).length > 1
        ) {
          const shouldImport = await notifications.confirm(
            "Подтверждение импорта",
            `Импортировать сценарий "${loadedScenario.title || scenarioId}"?\n\nТекущие несохранённые изменения будут потеряны.`,
          );

          if (!shouldImport) {
            return;
          }
        }

        scenarioState.meta.id = scenarioId;
        scenarioState.meta.title = loadedScenario.title || "";
        scenarioState.meta.description = loadedScenario.description || "";
        scenarioState.meta.author = loadedScenario.author || "";
        scenarioState.meta.start_dialogue =
          loadedScenario.start_dialogue || "start";
        scenarioState.dialogues = loadedScenario.dialogues || {
          start: { text: "", scene: "" },
        };

        renderAll();
        notifications.success(
          "Импорт завершён",
          `Сценарий "${loadedScenario.title || scenarioId}" загружен успешно`,
        );
      } catch (error) {
        console.error("Import error:", error);
        notifications.error("Ошибка импорта", error.message);
      } finally {
        // Clear the file input
        importScenarioInput.value = "";
      }
    };

    reader.readAsText(file);
  }

  exportScenarioBtn.addEventListener("click", exportScenario);

  importScenarioBtn.addEventListener("click", () => {
    importScenarioInput.click();
  });

  importScenarioInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      importScenario(file);
    }
  });

  newScenarioBtn.addEventListener("click", createNewScenario);

  document
    .querySelector(".creator-container")
    .addEventListener("change", handleStateUpdate);
  document
    .querySelector(".creator-container")
    .addEventListener("input", handleStateUpdate);
  document
    .querySelector(".creator-container")
    .addEventListener("click", handleClicks);

  renderAll();
  loadScenariosList();
});
