document.addEventListener('DOMContentLoaded', () => {
    let scenarioState = {
        meta: {
            id: '',
            title: '',
            description: '',
            author: '',
            start_dialogue: 'start'
        },
        dialogues: {
            'start': { text: '', scene: '' },
        }
    };

    const charactersData = JSON.parse(document.getElementById('characters-data').textContent);
    const scenesData = JSON.parse(document.getElementById('scenes-data').textContent);

    const addDialogueBtn = document.getElementById('add-dialogue-btn');
    const saveJsonBtn = document.getElementById('save-json-btn');
    const loadJsonInput = document.getElementById('load-json-input');
    const cardsContainer = document.getElementById('dialogue-cards-container');
    const cardTemplate = document.getElementById('dialogue-card-template');
    const choiceTemplate = document.getElementById('choice-row-template');

    function renderAll() {
        document.getElementById('scenario-id').value = scenarioState.meta.id || '';
        document.getElementById('scenario-title').value = scenarioState.meta.title || '';
        document.getElementById('scenario-description').value = scenarioState.meta.description || '';
        document.getElementById('scenario-author').value = scenarioState.meta.author || '';

        cardsContainer.innerHTML = '';
        const dialogueIds = Object.keys(scenarioState.dialogues);

        for (const dialogueId of dialogueIds) {
            const cardNode = createDialogueCard(dialogueId, scenarioState.dialogues[dialogueId]);
            cardsContainer.appendChild(cardNode);
        }
        
        updateAllNextDialogueDropdowns();
    }

    function createDialogueCard(id, data) {
        const card = cardTemplate.content.cloneNode(true).firstElementChild;
        card.dataset.id = id;

        const idInput = card.querySelector('.dialogue-id-input');
        card.querySelector('.dialogue-id-display').textContent = id;
        idInput.value = id;
        card.querySelector('.dialogue-text-input').value = data.text || '';
        
        if (id === 'start') {
            idInput.disabled = true;
            const removeButton = card.querySelector('.remove-dialogue-btn');
            if (removeButton) {
                removeButton.remove();
            }
        }
        
        const sceneSelect = card.querySelector('.scene-select');
        for (const sceneId in scenesData) {
            const option = new Option(scenesData[sceneId].name, sceneId);
            sceneSelect.appendChild(option);
        }
        sceneSelect.value = data.scene || '';
        
        const slotsContainer = card.querySelector('.characters-slots-container');
        populateCharacterSlots(slotsContainer, data.characters_on_screen || []);

        populateSpeakerDropdown(card.querySelector('.speaker-select'), data.characters_on_screen || [], data.character);
        
        const choicesContainer = card.querySelector('.choices-container');
        if (data.choices) {
            data.choices.forEach(choice => {
                const choiceRow = createChoiceRow(choice.text, choice.next);
                choicesContainer.appendChild(choiceRow);
            });
        }

        card.querySelector('.bgm-input').value = data.bgm || '';
        card.querySelector('.sfx-input').value = data.sfx || '';

        return card;
    }

    function createChoiceRow(text = '', next = '') {
        const row = choiceTemplate.content.cloneNode(true).firstElementChild;
        row.querySelector('.choice-text-input').value = text;
        return row;
    }

    function populateCharacterSlots(slotsContainer, charactersOnScreen) {
        // Clear existing slots
        slotsContainer.innerHTML = '';
        
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
    }
    
    function addCharacterSlot(container, charData = null, slotNumber = null) {
        const slotTemplate = document.getElementById('character-slot-template');
        const slot = slotTemplate.content.cloneNode(true).firstElementChild;
        
        if (slotNumber === null) {
            slotNumber = container.children.length + 1;
        }
        
        slot.querySelector('.slot-number').textContent = slotNumber;
        
        const charSelect = slot.querySelector('.character-select');
        const poseSelect = slot.querySelector('.pose-select');
        
        // Populate character dropdown excluding already selected characters
        populateCharacterDropdown(charSelect, container, charData ? charData.id : null);
        
        // Set values if character data provided
        if (charData) {
            charSelect.value = charData.id;
            populatePoseDropdown(poseSelect, charData.id, charData.pose);
        }
        
        container.appendChild(slot);
        updateSlotNumbers(container);
        
        // Add event listener for character selection changes
        charSelect.addEventListener('change', () => {
            updateAllCharacterDropdowns(container);
        });
    }
    
    function populateCharacterDropdown(charSelect, container, currentCharId = null) {
        // Get already selected character IDs (excluding the current one)
        const selectedCharIds = new Set();
        container.querySelectorAll('.character-select').forEach(select => {
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
        container.querySelectorAll('.character-slot').forEach(slot => {
            const charSelect = slot.querySelector('.character-select');
            const currentValue = charSelect.value;
            populateCharacterDropdown(charSelect, container, currentValue);
            charSelect.value = currentValue; // Restore selection
        });
    }
    
    function updateSlotNumbers(container) {
        const slots = container.querySelectorAll('.character-slot');
        slots.forEach((slot, index) => {
            slot.querySelector('.slot-number').textContent = index + 1;
        });
    }

    function populatePoseDropdown(select, charId, selectedPose) {
        select.innerHTML = '';
        if (charId && charactersData[charId]) {
            for (const poseId in charactersData[charId].poses) {
                const option = new Option(poseId, poseId);
                select.appendChild(option);
            }
            select.value = selectedPose || 'neutral';
        }
    }

    function populateSpeakerDropdown(select, charactersOnScreen, selectedSpeaker) {
        select.innerHTML = '<option value="">-- Рассказчик --</option>';
        charactersOnScreen.forEach(char => {
            const charName = charactersData[char.id]?.name || char.id;
            const option = new Option(charName, char.id);
            select.appendChild(option);
        });
        select.value = selectedSpeaker || '';
    }

    function updateAllNextDialogueDropdowns() {
        const dialogueIds = Object.keys(scenarioState.dialogues);
        const allSelects = document.querySelectorAll('.next-dialogue-select, .choice-next-select');
        
        allSelects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = `<option value="">-- Конец ветки --</option>`;
            dialogueIds.forEach(id => {
                const option = new Option(id, id);
                select.appendChild(option);
            });
            if (dialogueIds.includes(currentValue) || currentValue === '') {
                select.value = currentValue;
            } else {
                select.value = '';
            }
        });

        document.querySelectorAll('.dialogue-card').forEach(card => {
            const cardId = card.dataset.id;
            const cardData = scenarioState.dialogues[cardId];
            if (cardData) {
                card.querySelector('.next-dialogue-select').value = cardData.next || '';
                card.querySelectorAll('.choice-row').forEach((row, index) => {
                   if(cardData.choices && cardData.choices[index]) {
                       row.querySelector('.choice-next-select').value = cardData.choices[index].next || '';
                   }
                });
            }
        });
    }



    function handleStateUpdate(e) {
        const target = e.target;
        
        function sanitizeId(value) {
            if (!value) return '';
            return value.toLowerCase()
                .replace(/[\s-]+/g, '_')
                .replace(/[^a-z0-9_]/g, '');
        }

        if (target.id.startsWith('scenario-')) {
            const metaKey = target.id.replace('scenario-', '');
            
            if (target.id === 'scenario-id') {
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

        const card = target.closest('.dialogue-card');
        if (!card) return;
        const dialogueId = card.dataset.id;
        const dialogue = scenarioState.dialogues[dialogueId];
        if (!dialogue) return;

        if (target.classList.contains('dialogue-id-input')) {
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
                card.querySelector('.dialogue-id-display').textContent = newId;
                updateAllNextDialogueDropdowns();
            } else if (newId !== dialogueId && scenarioState.dialogues[newId]) {
                target.value = dialogueId;
            }
            return;
        }
        
        if (target.classList.contains('dialogue-text-input')) dialogue.text = target.value;
        if (target.classList.contains('speaker-select')) dialogue.character = target.value || null;
        if (target.classList.contains('next-dialogue-select')) dialogue.next = target.value || null;
        if (target.classList.contains('scene-select')) dialogue.scene = target.value || undefined;
        if (target.classList.contains('bgm-input')) dialogue.bgm = target.value || undefined;
        if (target.classList.contains('sfx-input')) dialogue.sfx = target.value || undefined;
        
        if (target.matches('.character-select, .pose-select')) {
            const charactersOnScreen = [];
            card.querySelectorAll('.character-slot').forEach(slot => {
                const charId = slot.querySelector('.character-select').value;
                if (charId) {
                    charactersOnScreen.push({
                        id: charId,
                        pose: slot.querySelector('.pose-select').value || 'neutral'
                    });
                }
            });
            dialogue.characters_on_screen = charactersOnScreen;

            if(target.classList.contains('character-select')) {
                const slot = target.closest('.character-slot');
                const slotsContainer = slot.parentElement;
                const poseSelect = slot.querySelector('.pose-select');
                
                populatePoseDropdown(poseSelect, target.value);
                populateSpeakerDropdown(card.querySelector('.speaker-select'), charactersOnScreen, dialogue.character);
                
                // Update all character dropdowns to reflect the new selection
                updateAllCharacterDropdowns(slotsContainer);
            }
        }
        
        if (target.matches('.choice-text-input, .choice-next-select')) {
            const choices = [];
            card.querySelectorAll('.choice-row').forEach(row => {
                const text = row.querySelector('.choice-text-input').value;
                const next = row.querySelector('.choice-next-select').value;
                if (text) {
                    choices.push({ text, next: next || null });
                }
            });
            dialogue.choices = choices.length > 0 ? choices : undefined;
            if (dialogue.choices) {
                dialogue.next = null;
                card.querySelector('.next-dialogue-select').value = '';
                card.querySelector('.next-dialogue-select').disabled = true;
            } else {
                card.querySelector('.next-dialogue-select').disabled = false;
            }
        }
    }

    function handleClicks(e) {
        const target = e.target;

        if (target.classList.contains('remove-dialogue-btn')) {
            const dialogueCard = target.closest('.dialogue-card');
            if (dialogueCard) {
                const dialogueId = dialogueCard.dataset.id;
                if (dialogueId === 'start') {
                    alert('Нельзя удалить стартовую реплику "start".');
                    return;
                }
                if (confirm(`Вы уверены, что хотите удалить реплику "${dialogueId}"?`)) {
                    delete scenarioState.dialogues[dialogueId];
                    renderAll();
                }
            }
            return;
        }

        if (target.matches('.remove-btn') && target.closest('.choice-row')) {
            const choiceRow = target.closest('.choice-row');
            const dialogueCard = choiceRow.closest('.dialogue-card');
            choiceRow.remove();
            handleStateUpdate({ target: dialogueCard.querySelector('.choices-container') });
            return;
        }
        
        if (target.classList.contains('add-choice-btn')) {
            const card = target.closest('.dialogue-card');
            const choicesContainer = card.querySelector('.choices-container');
            const choiceRow = createChoiceRow();
            choicesContainer.appendChild(choiceRow);
            updateAllNextDialogueDropdowns();
            handleStateUpdate({ target: choicesContainer });
            return;
        }
        
        if (target.classList.contains('add-character-btn')) {
            const card = target.closest('.dialogue-card');
            const slotsContainer = card.querySelector('.characters-slots-container');
            addCharacterSlot(slotsContainer);
            return;
        }
        
        if (target.classList.contains('remove-character-btn')) {
            const slot = target.closest('.character-slot');
            const slotsContainer = slot.parentElement;
            const card = target.closest('.dialogue-card');
            
            slot.remove();
            updateSlotNumbers(slotsContainer);
            
            // Update all character dropdowns after removal
            updateAllCharacterDropdowns(slotsContainer);
            
            // Update state
            const charactersOnScreen = [];
            card.querySelectorAll('.character-slot').forEach(slot => {
                const charId = slot.querySelector('.character-select').value;
                if (charId) {
                    charactersOnScreen.push({
                        id: charId,
                        pose: slot.querySelector('.pose-select').value || 'neutral'
                    });
                }
            });
            const dialogueId = card.dataset.id;
            scenarioState.dialogues[dialogueId].characters_on_screen = charactersOnScreen;
            
            // Update speaker dropdown
            populateSpeakerDropdown(card.querySelector('.speaker-select'), charactersOnScreen, scenarioState.dialogues[dialogueId].character);
            return;
        }
    }

    addDialogueBtn.addEventListener('click', () => {
        const newId = `dialogue_${Date.now()}`;
        if (scenarioState.dialogues[newId]) return;
        
        scenarioState.dialogues[newId] = { text: '', scene: '' };
        renderAll();
        
        const newCard = document.querySelector(`[data-id="${newId}"]`);
        if (newCard) {
            newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    saveJsonBtn.addEventListener('click', () => {
        if (!scenarioState.meta.id) {
            alert('Пожалуйста, укажите ID сценария в метаданных!');
            return;
        }
        
        const finalJson = {
            scenarios: {
                [scenarioState.meta.id]: {
                    title: scenarioState.meta.title,
                    description: scenarioState.meta.description,
                    author: scenarioState.meta.author,
                    start_dialogue: scenarioState.meta.start_dialogue,
                    dialogues: scenarioState.dialogues
                }
            }
        };

        const blob = new Blob([JSON.stringify(finalJson, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${scenarioState.meta.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    loadJsonInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!data.scenarios) throw new Error("Отсутствует ключ 'scenarios'");

                const scenarioId = Object.keys(data.scenarios)[0];
                if (!scenarioId) throw new Error("Не найден ни один сценарий в файле");
                
                const loadedScenario = data.scenarios[scenarioId];
                
                scenarioState.meta.id = scenarioId;
                scenarioState.meta.title = loadedScenario.title;
                scenarioState.meta.description = loadedScenario.description;
                scenarioState.meta.author = loadedScenario.author;
                scenarioState.meta.start_dialogue = loadedScenario.start_dialogue;
                scenarioState.dialogues = loadedScenario.dialogues || {};

                renderAll();

            } catch (err) {
                alert(`Ошибка чтения файла: ${err.message}`);
            } finally {
                loadJsonInput.value = '';
            }
        };
        reader.readAsText(file);
    });

    document.querySelector('.creator-container').addEventListener('change', handleStateUpdate);
    document.querySelector('.creator-container').addEventListener('input', handleStateUpdate);
    document.querySelector('.creator-container').addEventListener('click', handleClicks);

    renderAll();
});