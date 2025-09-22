document.addEventListener('DOMContentLoaded', () => {
    const poseKeys = ['neutral', 'happy', 'sad', 'angry', 'shy', 'curious'];
    const poseLabels = {
        'neutral': 'Нейтральное\n(neutral)',
        'happy': 'Счастливое\n(happy)',
        'sad': 'Грустное\n(sad)',
        'angry': 'Сердитое\n(angry)',
        'shy': 'Смущённое\n(shy)',
        'curious': 'Любопытное\n(curious)'
    };

    let characterState = {
        id: '',
        name: '',
        color: '#20c997',
        poses: {}
    };

    // DOM elements
    const poseGrid = document.getElementById('pose-grid');
    const idInput = document.getElementById('char-id');
    const nameInput = document.getElementById('char-name');
    const colorInput = document.getElementById('char-color');
    const saveBtn = document.getElementById('save-character-btn');
    const loadSelect = document.getElementById('load-character-select');
    const loadBtn = document.getElementById('load-character-btn');
    const newBtn = document.getElementById('new-character-btn');
    const exportBtn = document.getElementById('export-character-btn');
    const importBtn = document.getElementById('import-character-btn');
    const importInput = document.getElementById('import-character-input');
    const progressDiv = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    // Initialize pose slots
    function initializePoseSlots() {
        poseGrid.innerHTML = '';
        poseKeys.forEach(key => {
            const slotHTML = `
                <div class="pose-slot" id="slot-${key}" data-pose="${key}">
                    <div class="pose-placeholder" id="placeholder-${key}"></div>
                    <div class="pose-image-wrapper" id="wrapper-${key}" style="display: none;">
                        <img src="" alt="${poseLabels[key]} preview" id="preview-${key}" class="pose-preview">
                    </div>
                    <div class="pose-label">${poseLabels[key]}</div>
                    <input type="file" id="file-${key}" accept="image/png, image/jpeg, image/webp, image/jpg" class="file-input-hidden">
                    <button type="button" class="upload-btn" data-pose="${key}">Загрузить</button>
                    <div class="pose-status" id="status-${key}" style="display: none;"></div>
                </div>
            `;
            poseGrid.insertAdjacentHTML('beforeend', slotHTML);
        });

        // Add click handlers for upload buttons
        document.querySelectorAll('.upload-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const pose = btn.dataset.pose;
                document.getElementById(`file-${pose}`).click();
            });
        });

        // Add file input handlers
        poseKeys.forEach(key => {
            document.getElementById(`file-${key}`).addEventListener('change', (e) => {
                handleFileUpload(e, key);
            });
        });
    }

    // Sanitize character ID
    function sanitizeId(value) {
        if (!value) return '';
        return value.toLowerCase()
            .replace(/[\s-]+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
    }

    // Update character state
    function updateCharacterState() {
        characterState.id = sanitizeId(idInput.value);
        characterState.name = nameInput.value;
        characterState.color = colorInput.value;
    }

    // Handle file upload
    async function handleFileUpload(e, key) {
        const file = e.target.files[0];
        if (!file) return;

        updateCharacterState();
        
        if (!characterState.id) {
            notifications.error('Ошибка загрузки', 'Пожалуйста, сначала укажите ID персонажа');
            e.target.value = '';
            return;
        }

        const slot = document.getElementById(`slot-${key}`);
        const preview = document.getElementById(`preview-${key}`);
        const placeholder = document.getElementById(`placeholder-${key}`);
        const status = document.getElementById(`status-${key}`);
        const uploadBtn = slot.querySelector('.upload-btn');

        // Show uploading state
        slot.classList.add('uploading');
        uploadBtn.disabled = true;
        status.style.display = 'block';
        status.className = 'pose-status uploading';
        status.textContent = 'Загрузка...';

        // Show preview immediately
        const wrapper = document.getElementById(`wrapper-${key}`);
        const reader = new FileReader();
        reader.onload = (event) => {
            preview.src = event.target.result;
            wrapper.style.display = 'block';
            placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);

        try {
            // Upload to server
            const formData = new FormData();
            formData.append('image', file);
            formData.append('character_id', characterState.id);
            formData.append('pose_name', key);

            const response = await fetch('/api/characters/upload-image', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                characterState.poses[key] = result.path;
                slot.classList.remove('uploading');
                slot.classList.add('filled');
                status.className = 'pose-status success';
                status.textContent = 'Загружено';
            } else if (result.requires_auth) {
                // Authentication required - prompt for login
                const authenticated = await auth.ensureAuthenticated();
                if (authenticated) {
                    // Retry the upload
                    handleFileUpload(e, key);
                    return;
                } else {
                    throw new Error('Авторизация отменена');
                }
            } else {
                throw new Error(result.error || 'Ошибка загрузки');
            }
        } catch (error) {
            console.error('Upload error:', error);
            slot.classList.remove('uploading');
            wrapper.style.display = 'none';
            placeholder.style.display = 'flex';
            status.className = 'pose-status error';
            status.textContent = error.message;
            e.target.value = '';
        } finally {
            uploadBtn.disabled = false;
        }
    }

    // Save character to server
    async function saveCharacter() {
        updateCharacterState();

        if (!characterState.id || !characterState.name) {
            notifications.error('Необходимые данные', 'Пожалуйста, укажите ID и имя персонажа');
            return;
        }

        const missingPoses = poseKeys.filter(key => !characterState.poses[key]);
        if (missingPoses.length > 0) {
            const missingLabels = missingPoses.map(key => poseLabels[key]).join(', ');
            const shouldContinue = await notifications.confirm('Неполные данные', `Не хватает изображений для: ${missingLabels}.\n\nСохранить всё равно?`);
            if (!shouldContinue) {
                return;
            }
        }

        try {
            showProgress('Сохранение персонажа...');

            const characterData = {
                characters: {
                    [characterState.id]: {
                        name: characterState.name,
                        color: characterState.color,
                        poses: characterState.poses
                    }
                }
            };

            const response = await fetch('/api/characters/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(characterData)
            });

            const result = await response.json();

            if (result.success) {
                notifications.success('Успешно', result.message);
                await loadCharactersList();
            } else if (result.requires_auth) {
                // Authentication required - prompt for login
                const authenticated = await auth.ensureAuthenticated();
                if (authenticated) {
                    // Retry the save operation
                    await saveCharacter();
                    return;
                }
            } else {
                notifications.error('Ошибка сохранения', result.error);
            }
        } catch (error) {
            console.error('Save error:', error);
            notifications.error('Ошибка сохранения', 'Не удалось сохранить персонажа. Попробуйте снова.');
        } finally {
            hideProgress();
        }
    }

    // Load characters list
    async function loadCharactersList() {
        try {
            const response = await fetch('/api/characters/list');
            const result = await response.json();

            if (result.characters) {
                loadSelect.innerHTML = '<option value="">-- Загрузить персонажа --</option>';
                
                result.characters.forEach(char => {
                    const option = new Option(
                        `${char.name} (ID: ${char.id})`,
                        char.id
                    );
                    loadSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading characters list:', error);
        }
    }

    // Load character
    async function loadCharacter(characterId) {
        try {
            showProgress('Загрузка персонажа...');
            
            const response = await fetch('/api/content/characters');
            const characters = await response.json();
            
            if (characters[characterId]) {
                const char = characters[characterId];
                
                // Update form
                idInput.value = characterId;
                nameInput.value = char.name || '';
                colorInput.value = char.color || '#20c997';
                
                // Update state
                characterState = {
                    id: characterId,
                    name: char.name || '',
                    color: char.color || '#20c997',
                    poses: char.poses || {}
                };
                
                // Update pose previews
                poseKeys.forEach(key => {
                    const slot = document.getElementById(`slot-${key}`);
                    const preview = document.getElementById(`preview-${key}`);
                    const wrapper = document.getElementById(`wrapper-${key}`);
                    const placeholder = document.getElementById(`placeholder-${key}`);
                    const status = document.getElementById(`status-${key}`);
                    
                    if (char.poses && char.poses[key]) {
                        preview.src = char.poses[key];
                        wrapper.style.display = 'block';
                        placeholder.style.display = 'none';
                        slot.classList.add('filled');
                        status.style.display = 'block';
                        status.className = 'pose-status success';
                        status.textContent = 'Загружено';
                    } else {
                        wrapper.style.display = 'none';
                        placeholder.style.display = 'flex';
                        slot.classList.remove('filled');
                        status.style.display = 'none';
                    }
                });
                
                notifications.success('Загрузка завершена', 'Персонаж загружен успешно!');
            } else {
                notifications.error('Ошибка загрузки', 'Персонаж не найден');
            }
        } catch (error) {
            console.error('Load error:', error);
            notifications.error('Ошибка загрузки', 'Не удалось загрузить персонажа. Попробуйте снова.');
        } finally {
            hideProgress();
        }
    }

    // Create new character
    async function createNewCharacter() {
        const shouldCreate = await notifications.confirm('Новый персонаж', 'Создать нового персонажа?\n\nНесохранённые изменения будут потеряны.');
        if (shouldCreate) {
            // Reset form
            idInput.value = '';
            nameInput.value = '';
            colorInput.value = '#20c997';
            
            // Reset state
            characterState = {
                id: '',
                name: '',
                color: '#20c997',
                poses: {}
            };
            
            // Reset pose slots
            poseKeys.forEach(key => {
                const slot = document.getElementById(`slot-${key}`);
                const preview = document.getElementById(`preview-${key}`);
                const wrapper = document.getElementById(`wrapper-${key}`);
                const placeholder = document.getElementById(`placeholder-${key}`);
                const status = document.getElementById(`status-${key}`);
                const fileInput = document.getElementById(`file-${key}`);
                
                wrapper.style.display = 'none';
                placeholder.style.display = 'flex';
                slot.classList.remove('filled', 'uploading');
                status.style.display = 'none';
                fileInput.value = '';
            });
        }
    }

    // Show progress
    function showProgress(message) {
        progressText.textContent = message;
        progressDiv.style.display = 'block';
    }

    // Hide progress
    function hideProgress() {
        progressDiv.style.display = 'none';
    }

    // Event listeners
    idInput.addEventListener('input', () => {
        const sanitized = sanitizeId(idInput.value);
        if (idInput.value !== sanitized) {
            idInput.value = sanitized;
        }
    });

    saveBtn.addEventListener('click', saveCharacter);
    
    loadBtn.addEventListener('click', () => {
        const selectedCharacter = loadSelect.value;
        if (selectedCharacter) {
            loadCharacter(selectedCharacter);
        } else {
            notifications.warning('Выбор персонажа', 'Пожалуйста, выберите персонажа для загрузки.');
        }
    });
    
    function exportCharacter() {
        updateCharacterState();
        
        if (!characterState.id || !characterState.name) {
            notifications.error('Необходимые данные', 'Пожалуйста, укажите ID и имя персонажа перед экспортом');
            return;
        }
        
        const characterData = {
            characters: {
                [characterState.id]: {
                    name: characterState.name,
                    color: characterState.color,
                    poses: characterState.poses
                }
            }
        };
        
        const jsonString = JSON.stringify(characterData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${characterState.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        notifications.success('Экспорт завершён', `Файл ${characterState.id}.json скачан успешно`);
    }
    
    function importCharacter(file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!data.characters) {
                    throw new Error('Неверный формат файла. Отсутствует секция "characters".');
                }
                
                const characterIds = Object.keys(data.characters);
                if (characterIds.length === 0) {
                    throw new Error('Файл не содержит персонажей.');
                }
                
                const characterId = characterIds[0];
                const loadedCharacter = data.characters[characterId];
                
                if (characterState.id || characterState.name) {
                    const shouldImport = await notifications.confirm(
                        'Подтверждение импорта', 
                        `Импортировать персонажа "${loadedCharacter.name || characterId}"?\n\nТекущие несохранённые изменения будут потеряны.`
                    );
                    
                    if (!shouldImport) {
                        return;
                    }
                }
                
                idInput.value = characterId;
                nameInput.value = loadedCharacter.name || '';
                colorInput.value = loadedCharacter.color || '#20c997';
                
                characterState = {
                    id: characterId,
                    name: loadedCharacter.name || '',
                    color: loadedCharacter.color || '#20c997',
                    poses: {}
                };
                
                const posesData = loadedCharacter.poses || {};
                
                poseKeys.forEach(key => {
                    const slot = document.getElementById(`slot-${key}`);
                    const preview = document.getElementById(`preview-${key}`);
                    const wrapper = document.getElementById(`wrapper-${key}`);
                    const placeholder = document.getElementById(`placeholder-${key}`);
                    const status = document.getElementById(`status-${key}`);
                    const fileInput = document.getElementById(`file-${key}`);
                    
                    wrapper.style.display = 'none';
                    placeholder.style.display = 'flex';
                    slot.classList.remove('filled', 'uploading');
                    status.style.display = 'none';
                    fileInput.value = '';
                });
                
                for (const [poseName, imagePath] of Object.entries(posesData)) {
                    if (poseKeys.includes(poseName)) {
                        const slot = document.getElementById(`slot-${poseName}`);
                        const preview = document.getElementById(`preview-${poseName}`);
                        const wrapper = document.getElementById(`wrapper-${poseName}`);
                        const placeholder = document.getElementById(`placeholder-${poseName}`);
                        const status = document.getElementById(`status-${poseName}`);
                        
                        if (imagePath) {
                            preview.src = imagePath;
                            wrapper.style.display = 'block';
                            placeholder.style.display = 'none';
                            slot.classList.add('filled');
                            status.style.display = 'block';
                            status.className = 'pose-status success';
                            status.textContent = 'Загружено';
                            characterState.poses[poseName] = imagePath;
                        }
                    }
                }
                
                notifications.success('Импорт завершён', `Персонаж "${loadedCharacter.name || characterId}" загружен успешно`);
                
            } catch (error) {
                console.error('Import error:', error);
                notifications.error('Ошибка импорта', error.message);
            } finally {
                importInput.value = '';
            }
        };
        
        reader.readAsText(file);
    }
    
    exportBtn.addEventListener('click', exportCharacter);
    
    importBtn.addEventListener('click', () => {
        importInput.click();
    });
    
    importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            importCharacter(file);
        }
    });
    
    newBtn.addEventListener('click', createNewCharacter);

    // Initialize
    initializePoseSlots();
    loadCharactersList();
});
