class AudioManager {
    constructor() {
        this.bgmPlayer = document.getElementById('bgmPlayer');
        this.sfxPlayer = document.getElementById('sfxPlayer');
        this.currentBGM = '';
        this.volume = 0.5;
        this.fadeInterval = null;
        this.isUnlocked = false;
    }

    playBGM(src) {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }

        if (src === 'stop') {
            this.stopBGM(true);
            return;
        }
        
        if (this.currentBGM === src && !this.bgmPlayer.paused) return;
        
        this.currentBGM = src;
        this.bgmPlayer.src = src;
        
        this.bgmPlayer.play().then(() => {
            this.fade(this.bgmPlayer, 0, this.volume, 1000);
        }).catch(e => console.error("BGM play failed:", e));
    }

    stopBGM(shouldFade = false, callback) {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
        
        if (this.bgmPlayer.paused) {
            this.currentBGM = '';
            if (callback) callback();
            return;
        }

        const onStop = () => {
            this.bgmPlayer.pause();
            this.currentBGM = '';
            if (callback) callback();
        };

        if (shouldFade) {
            this.fade(this.bgmPlayer, this.bgmPlayer.volume, 0, 1000, onStop);
        } else {
            onStop();
        }
    }
    
    unlockAudio() {
        if (this.isUnlocked) return;
        const silentSound = "data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSUNSAAAACgAAADIZMDIxAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
        this.bgmPlayer.src = silentSound;
        const promise = this.bgmPlayer.play();
        if (promise !== undefined) {
            promise.then(_ => {
                this.bgmPlayer.pause();
                this.bgmPlayer.src = '';
                this.isUnlocked = true;
                console.log("Audio context unlocked.");
            }).catch(error => {
                console.warn("Audio unlock failed, will try again on next user interaction.", error);
            });
        }
    }

    playSFX(src) {
        this.sfxPlayer.src = src;
        this.sfxPlayer.play().catch(e => console.error("SFX play failed:", e));
    }

    setVolume(value) {
        this.volume = parseFloat(value);
        this.bgmPlayer.volume = this.volume;
        this.sfxPlayer.volume = this.volume;
        const volumeValueEl = document.getElementById('volumeValue');
        if (volumeValueEl) {
            volumeValueEl.textContent = `${Math.round(this.volume * 100)}%`;
        }
    }

    fade(player, from, to, duration, callback) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        
        let steps = 50;
        let stepTime = duration / steps;
        let volumeStep = (to - from) / steps;
        
        player.volume = from;
        
        const checkVolume = (vol) => Math.max(0, Math.min(1, vol));

        this.fadeInterval = setInterval(() => {
            let newVolume = player.volume + volumeStep;

            if ((volumeStep > 0 && newVolume >= to) || (volumeStep < 0 && newVolume <= to)) {
                player.volume = checkVolume(to);
                clearInterval(this.fadeInterval);
                this.fadeInterval = null;
                if (callback) callback();
            } else {
                player.volume = checkVolume(newVolume);
            }
        }, stepTime);
    }
}

class VisualNovelEngine {
    constructor() {
        this.gameData = { characters: {}, scenes: {}, scenarios: {} };
        this.gameState = { currentScenario: null, currentDialogue: 'start', variables: {}, history: [] };
        this.settings = { textSpeed: 30, autoPlay: false, fullscreen: false };
        this.isTyping = false;
        this.currentText = '';
        this.autoMode = false;
        this.autoDelay = 3000;
        this.nextActionCallback = null;
        this.previousScreen = 'mainMenu';
        this.audioManager = new AudioManager();
        this.initializeEngine();
    }

    async initializeEngine() {
        console.log('Initializing Visual Novel Engine v4.0...');
        await this.loadContentFromServer();
        this.setupEventListeners();
        this.loadSettings();

        const scenarioToStart = document.body.dataset.scenarioToStart;
        if (scenarioToStart && this.gameData.scenarios[scenarioToStart]) {
            console.log(`Starting scenario '${scenarioToStart}' from URL parameter.`);
            this.startGame(scenarioToStart);
        } else {
            this.showMainMenu();
        }
        console.log('Engine initialized successfully');
    }

    setupEventListeners() {
        const dialogueBox = document.getElementById('dialogueBox');
        if (dialogueBox) {
            dialogueBox.addEventListener('click', () => {
                if (this.isTyping) {
                    this.completeTyping();
                } else if (this.nextActionCallback) {
                    const action = this.nextActionCallback;
                    this.nextActionCallback = null;
                    action();
                }
            });
        }
        document.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') { if (this.nextActionCallback) { e.preventDefault(); const action = this.nextActionCallback; this.nextActionCallback = null; action(); } } else if (e.code === 'Escape') { this.showMainMenu(); } });
    }

    async loadContentFromServer() {
        try {
            const [charactersResponse, scenesResponse, scenariosResponse] = await Promise.all([
                fetch('/api/content/characters'),
                fetch('/api/content/scenes'),
                fetch('/api/content/scenarios')
            ]);
            this.gameData.characters = await charactersResponse.json();
            this.gameData.scenes = await scenesResponse.json();
            this.gameData.scenarios = await scenariosResponse.json();
            console.log('Content loaded from server:', this.gameData);
        } catch (error) {
            console.error('Error loading content from server:', error);
        }
    }

    showScenarioSelection() {
        const scenarioList = document.getElementById('scenarioList');
        scenarioList.innerHTML = ''; 

        const scenarios = Object.entries(this.gameData.scenarios);

        if (scenarios.length === 0) {
            scenarioList.innerHTML = '<p>Сценарии не найдены. Загрузите их через админ-панель.</p>';
        } else {
            scenarios.forEach(([id, scenario]) => {
                const scenarioButton = document.createElement('button');
                scenarioButton.className = 'btn btn--primary menu-btn';

                const authorHtml = scenario.author ? `<span class="scenario-author">Автор: ${scenario.author}</span>` : '';

                scenarioButton.innerHTML = `
                    ${scenario.title} 
                    <br>
                    <small class="scenario-description">${scenario.description || ''}</small>
                    ${authorHtml}
                `;

                scenarioButton.onclick = () => this.startGame(id);
                scenarioList.appendChild(scenarioButton);
            });
        }
        this.showScreen('scenarioSelectionMenu');
    }

    async startGame(scenarioId) {
        this.audioManager.unlockAudio();
        const scenario = this.gameData.scenarios[scenarioId];
        if (!scenario || Object.keys(scenario.dialogues).length === 0) {
            alert('Ошибка: Сценарий не найден или пуст!');
            return;
        }

        this.gameState = {
            currentScenario: scenarioId,
            currentDialogue: scenario.start_dialogue || 'start',
            variables: {},
            history: []
        };
        
        this.updateScenarioInfoDisplay(scenarioId);
        
        this.showGameScreen();
        await this.displayDialogue(this.gameState.currentDialogue);
    }

    async loadSavedGame() {
        this.audioManager.unlockAudio();
        try {
            const response = await fetch('/api/game/load');
            const savedState = await response.json();
            if (savedState && savedState.currentScenario && savedState.currentDialogue) {
                this.gameState = savedState;
                
                this.updateScenarioInfoDisplay(savedState.currentScenario);
                
                this.showGameScreen();
                await this.displayDialogue(savedState.currentDialogue);
            } else {
                alert('Сохранений не найдено или они повреждены.');
            }
        } catch (error) {
            console.error('Load error:', error);
            alert('Ошибка при загрузке игры');
        }
    }

    showMainMenu() {
        this.audioManager.stopBGM(true);
        this.clearScenarioInfoDisplay();
        this.showScreen('mainMenu');
    }

    

    checkCondition(conditionString) {
        if (!conditionString) return true;

        const operators = /(==|!=|>=|<=|>|<)/;
        const parts = conditionString.split(operators).map(p => p.trim());

        if (parts.length !== 3) {
            console.error(`Invalid condition format: "${conditionString}"`);
            return false;
        }

        const [varName, operator, valueStr] = parts;
        
        let stateValue = this.gameState.variables[varName];
        if (stateValue === undefined) stateValue = 0;

        let compareValue;
        if (valueStr.toLowerCase() === 'true') {
            compareValue = true;
        } else if (valueStr.toLowerCase() === 'false') {
            compareValue = false;
        } else if (!isNaN(parseFloat(valueStr))) {
            compareValue = parseFloat(valueStr);
        } else {
            compareValue = valueStr.replace(/^['"]|['"]$/g, '');
        }

        switch (operator) {
            case '==': return stateValue == compareValue;
            case '!=': return stateValue != compareValue;
            case '>':  return stateValue > compareValue;
            case '<':  return stateValue < compareValue;
            case '>=': return stateValue >= compareValue;
            case '<=': return stateValue <= compareValue;
            default:   return false;
        }
    }

    setVariable(key, value) {
        if (typeof value === 'string' && (value.startsWith('+') || value.startsWith('-'))) {
            const currentVal = this.gameState.variables[key] || 0;
            const change = parseFloat(value);
            this.gameState.variables[key] = currentVal + change;
        } else {
            this.gameState.variables[key] = value;
        }
        console.log("Variables updated:", this.gameState.variables);
    }
    
    async displayDialogue(dialogueId) {
        let currentId = dialogueId;
        let dialogue = null;
        let protection = 0;

        while (protection < 100) {
            const scenario = this.gameData.scenarios[this.gameState.currentScenario];
            if (!scenario) { console.error('Scenario not found'); return; }
            dialogue = scenario.dialogues[currentId];
            if (!dialogue) { console.error(`Dialogue not found: ${currentId}`); return; }

            if (this.checkCondition(dialogue.condition)) {
                break;
            } else {
                currentId = dialogue.next_if_false || dialogue.next;
                if (!currentId) { 
                    this.showMainMenu();
                    return;
                }
            }
            protection++;
        }
        if (protection >= 100) { console.error("Infinite loop!"); return; }

        if (dialogue.bgm) {
            this.audioManager.playBGM(dialogue.bgm);
        }
        if (dialogue.sfx) {
            this.audioManager.playSFX(dialogue.sfx);
        }

        if (dialogue.scene && this.gameData.scenes[dialogue.scene]) {
            this.setBackground(this.gameData.scenes[dialogue.scene].background);
        }

        this.nextActionCallback = null;
        document.getElementById('clickIndicator').classList.add('hidden');
        
        this.gameState.currentDialogue = dialogueId;
        this.updateHistory(dialogue);
        if (dialogue.scene && this.gameData.scenes[dialogue.scene]) { this.setBackground(this.gameData.scenes[dialogue.scene].background); }
        this.renderCharacters(dialogue.characters_on_screen, dialogue.character);
        if (dialogue.character && this.gameData.characters[dialogue.character]) { const char = this.gameData.characters[dialogue.character]; this.setCharacterName(char.name, char.color); } else { this.hideCharacterName(); }
        
        await this.typeText(dialogue.text);

        if (dialogue.choices && dialogue.choices.length > 0) {
            this.showChoices(dialogue.choices, dialogue.character);
        } else if (dialogue.next) {
            this.setNextAction(() => this.displayDialogue(dialogue.next));
        } else {
            this.setNextAction(() => this.showMainMenu());
        }
        this.autoSave();
    }


    
    setNextAction(callback) { this.nextActionCallback = callback; document.getElementById('clickIndicator').classList.remove('hidden'); if (this.autoMode && callback) { setTimeout(() => { if (this.nextActionCallback) { const action = this.nextActionCallback; this.nextActionCallback = null; action(); } }, this.autoDelay); } }
    showChoices(choices, speakerId) {
        document.getElementById('clickIndicator').classList.add('hidden');
        this.nextActionCallback = null;

        const choicesContainer = document.getElementById('choicesContainer');
        choicesContainer.innerHTML = '';
        
        let buttonColor = 'var(--color-teal)';
        if (speakerId && this.gameData.characters[speakerId]) {
            buttonColor = this.gameData.characters[speakerId].color;
        }

        const availableChoices = choices.filter(choice => this.checkCondition(choice.condition));

        if (availableChoices.length > 0) {
            availableChoices.forEach(choice => {
                const button = document.createElement('button');
                button.className = 'choice-button';
                button.textContent = choice.text;
                button.style.setProperty('--choice-bg', buttonColor);
                button.onclick = () => this.selectChoice(choice);
                choicesContainer.appendChild(button);
            });
            choicesContainer.classList.remove('hidden');
        } else {
            if (this.gameData.scenarios[this.gameState.currentScenario].dialogues[this.gameState.currentDialogue].next) {
                 this.setNextAction(() => this.displayDialogue(this.gameData.scenarios[this.gameState.currentScenario].dialogues[this.gameState.currentDialogue].next));
            } else {
                 this.setNextAction(() => this.showMainMenu());
            }
        }
    }
    updateScenarioInfoDisplay(scenarioId) {
        const scenario = this.gameData.scenarios[scenarioId];
        const titleEl = document.getElementById('scenarioTitle');
        const authorEl = document.getElementById('scenarioAuthor');

        if (scenario && titleEl && authorEl) {
            titleEl.textContent = scenario.title || 'Неизвестный сценарий';
            authorEl.textContent = scenario.author ? `Автор: ${scenario.author}` : '';
            document.getElementById('scenarioInfo').style.opacity = 1;
        }
    }

    clearScenarioInfoDisplay() {
        document.getElementById('scenarioTitle').textContent = '';
        document.getElementById('scenarioAuthor').textContent = '';
        document.getElementById('scenarioInfo').style.opacity = 0;
    }
    updateHistory(dialogue) { this.gameState.history.push({ id: this.gameState.currentDialogue, character: dialogue.character ? this.gameData.characters[dialogue.character]?.name : 'Сюжет', text: dialogue.text, timestamp: new Date().toLocaleTimeString() }); }
    setBackground(newBackgroundUrl) {
        const bgContainer = document.getElementById('backgroundContainer');
        const bg1 = document.getElementById('backgroundImage1');
        const bg2 = document.getElementById('backgroundImage2');
        
        const activeBg = bg1.classList.contains('active') ? bg1 : bg2;
        const inactiveBg = bg1.classList.contains('active') ? bg2 : bg1;

        if (activeBg.src.endsWith(newBackgroundUrl)) {
            return;
        }

        inactiveBg.src = newBackgroundUrl;

        inactiveBg.onload = () => {
            activeBg.classList.remove('active');
            inactiveBg.classList.add('active');
            
            inactiveBg.onload = null; 
        };
        
        inactiveBg.onerror = () => {
            console.error(`Failed to load background image: ${newBackgroundUrl}`);
            inactiveBg.onerror = null;
        }
    }
    renderCharacters(charactersOnScreen, speakerId) { const leftCharDiv = document.getElementById('leftCharacter'); const rightCharDiv = document.getElementById('rightCharacter'); leftCharDiv.classList.add('hidden'); rightCharDiv.classList.add('hidden'); leftCharDiv.classList.remove('active-speaker'); rightCharDiv.classList.remove('active-speaker'); if (!charactersOnScreen || charactersOnScreen.length === 0) { return; } charactersOnScreen.forEach(charInfo => { const charData = this.gameData.characters[charInfo.id]; if (!charData) { console.warn(`Character data not found for id: ${charInfo.id}`); return; } const pose = charInfo.pose || 'neutral'; if (!charData.poses[pose]) { console.warn(`Pose not found: ${charInfo.id}.${pose}`); return; } const position = charInfo.position; const charContainer = document.getElementById(`${position}Character`); const charImage = document.getElementById(`${position}CharacterImage`); if (charContainer && charImage) { charImage.src = charData.poses[pose]; charContainer.classList.remove('hidden'); if (charInfo.id === speakerId) { charContainer.classList.add('active-speaker'); } } }); }
    setCharacterName(name, color = '#20c997') { const nameElement = document.getElementById('characterName'); nameElement.textContent = name; nameElement.style.backgroundColor = color; nameElement.classList.remove('hidden'); }
    hideCharacterName() { document.getElementById('characterName').classList.add('hidden'); }
    async typeText(text) { const dialogueTextElement = document.getElementById('dialogueText'); this.isTyping = true; this.currentText = ''; dialogueTextElement.innerHTML = ''; for (let i = 0; i < text.length; i++) { if (!this.isTyping) break; this.currentText += text[i]; dialogueTextElement.innerHTML = this.currentText + '<span class="typing-cursor">|</span>'; await new Promise(resolve => setTimeout(resolve, this.settings.textSpeed)); } this.isTyping = false; dialogueTextElement.innerHTML = text; }
    completeTyping() { this.isTyping = false; }
    selectChoice(choice) {
        if (choice.set) {
            for (const key in choice.set) {
                this.setVariable(key, choice.set[key]);
            }
        }

        if (choice.next) {
            this.displayDialogue(choice.next);
        }
        this.hideChoices();
    }
    hideChoices() { const choicesContainer = document.getElementById('choicesContainer'); choicesContainer.classList.add('hidden'); choicesContainer.innerHTML = ''; }
    loadSettings() {
        const saved = localStorage.getItem('vnSettings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
        this.settings.volume = parseFloat(this.settings.volume);
        if (isNaN(this.settings.volume)) {
            this.settings.volume = 0.5;
        }
        
        this.audioManager.setVolume(this.settings.volume);
        this.updateUI();
    }
    saveSettings() { localStorage.setItem('vnSettings', JSON.stringify(this.settings)); }
    updateUI() { const textSpeedSlider = document.getElementById('textSpeed'); if (textSpeedSlider) textSpeedSlider.value = this.settings.textSpeed; const textSpeedValue = document.getElementById('textSpeedValue'); if (textSpeedValue) textSpeedValue.textContent = `${this.settings.textSpeed}ms`; const autoPlayCheckbox = document.getElementById('autoPlay'); if (autoPlayCheckbox) autoPlayCheckbox.checked = this.settings.autoPlay; const fullscreenCheckbox = document.getElementById('fullscreen'); if (fullscreenCheckbox) fullscreenCheckbox.checked = this.settings.fullscreen; const volumeSlider = document.getElementById('volumeControl'); if (volumeSlider) volumeSlider.value = this.settings.volume; const volumeValue = document.getElementById('volumeValue'); if (volumeValue) volumeValue.textContent = `${Math.round(this.settings.volume * 100)}%`;}
    toggleAutoMode() { this.autoMode = !this.autoMode; const autoButton = document.querySelector('.ui-btn[onclick="toggleAutoMode()"]'); if (autoButton) { autoButton.textContent = this.autoMode ? '⚡ Авто (ВКЛ)' : '⚡ Авто'; } }
    showHistory() { const historyContent = document.getElementById('historyContent'); historyContent.innerHTML = ''; this.gameState.history.slice(-20).forEach(item => { const historyItem = document.createElement('div'); historyItem.className = 'history-item'; historyItem.innerHTML = `<div class="history-character">${item.character} (${item.timestamp})</div><div>${item.text}</div>`; historyContent.appendChild(historyItem); }); this.showScreen('historyScreen'); }
    hideHistory() { this.showScreen('gameScreen'); }
    async saveGame() { try { const response = await fetch('/api/game/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.gameState) }); const result = await response.json(); if (result.success) { alert('💾 Игра сохранена!'); } else { alert('❌ Ошибка при сохранении: ' + (result.error || '')); } } catch (error) { console.error('Save error:', error); alert('❌ Ошибка при сохранении игры'); } }
    autoSave() { localStorage.setItem('vnAutoSave', JSON.stringify(this.gameState)); }
    showGameScreen() { this.showScreen('gameScreen'); }
    showSettings() {
        const currentScreen = document.querySelector('.screen:not(.hidden)');
        if (currentScreen) {
            this.previousScreen = currentScreen.id;
        }
        this.showScreen('settingsMenu');
        this.updateUI();
    }
    hideSettings() {
        this.showScreen(this.previousScreen || 'mainMenu'); 
    }
    showScreen(screenId) { document.querySelectorAll('.screen').forEach(screen => { screen.classList.add('hidden'); }); document.getElementById(screenId).classList.remove('hidden'); }
}

let engine;
document.addEventListener('DOMContentLoaded', () => { engine = new VisualNovelEngine(); });

function updateVolume(value) {
    if (engine) {
        engine.settings.volume = value;
        engine.audioManager.setVolume(value);
        engine.saveSettings();
    }
}

function showMainMenu() { if (engine) engine.showMainMenu(); }
function showScenarioSelection() { if (engine) engine.showScenarioSelection(); }
function startGame(id) { if (engine) engine.startGame(id); }
function loadGame() { if (engine) engine.loadSavedGame(); }
function showSettings() { if (engine) engine.showSettings(); }
function saveGame() { if (engine) engine.saveGame(); }
function toggleAutoMode() { if (engine) engine.toggleAutoMode(); }
function showHistory() { if (engine) engine.showHistory(); }
function hideHistory() { if (engine) engine.hideHistory(); }
function updateTextSpeed(value) { if (engine) { engine.settings.textSpeed = parseInt(value, 10); document.getElementById('textSpeedValue').textContent = `${value}ms`; engine.saveSettings(); } }
function toggleAutoPlay(checked) { if (engine) { engine.settings.autoPlay = checked; engine.saveSettings(); } }
function toggleFullscreen(checked) { if (engine) { engine.settings.fullscreen = checked; engine.saveSettings(); if (checked && document.documentElement.requestFullscreen) { document.documentElement.requestFullscreen(); } else if (!checked && document.exitFullscreen) { document.exitFullscreen(); } } }
function showSettings() { if (engine) engine.showSettings(); }
function hideSettings() { if (engine) engine.hideSettings(); }
function saveGame() { if (engine) engine.saveGame(); }