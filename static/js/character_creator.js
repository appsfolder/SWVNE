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
            alert('Пожалуйста, сначала укажите ID персонажа');
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
            alert('Пожалуйста, укажите ID и имя персонажа');
            return;
        }

        const missingPoses = poseKeys.filter(key => !characterState.poses[key]);
        if (missingPoses.length > 0) {
            const missingLabels = missingPoses.map(key => poseLabels[key]).join(', ');
            if (!confirm(`Не хватает изображений для: ${missingLabels}.\n\nСохранить всё равно?`)) {
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
                alert(result.message);
                await loadCharactersList();
            } else {
                alert('Ошибка сохранения: ' + result.error);
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('Ошибка сохранения персонажа');
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
                
                alert('Персонаж загружен успешно!');
            } else {
                alert('Персонаж не найден');
            }
        } catch (error) {
            console.error('Load error:', error);
            alert('Ошибка загрузки персонажа');
        } finally {
            hideProgress();
        }
    }

    // Create new character
    function createNewCharacter() {
        if (confirm('Создать нового персонажа? Несохранённые изменения будут потеряны.')) {
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
            alert('Пожалуйста, выберите персонажа для загрузки.');
        }
    });
    
    newBtn.addEventListener('click', createNewCharacter);

    // Initialize
    initializePoseSlots();
    loadCharactersList();
});
