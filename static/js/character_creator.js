document.addEventListener('DOMContentLoaded', () => {
    const poseKeys = ['neutral', 'happy', 'sad', 'angry', 'shy', 'curious'];
    const poseGrid = document.querySelector('.pose-grid');

    let characterState = {
        id: '',
        name: '',
        color: '#d1b380',
        poses: {}
    };

    poseKeys.forEach(key => {
        const readableName = key.charAt(0).toUpperCase() + key.slice(1);
        const slotHTML = `
            <div class="pose-slot" id="slot-${key}">
                <img src="" alt="${readableName} preview" id="preview-${key}">
                <label class="pose-label">${readableName}</label>
                <input type="file" id="file-${key}" accept="image/png, image/jpeg, image/webp" class="file-input-hidden" required>
                <label for="file-${key}" class="btn btn--secondary btn--small">Выбрать файл</label>
            </div>
        `;
        poseGrid.insertAdjacentHTML('beforeend', slotHTML);
    });

    const idInput = document.getElementById('char-id');
    const nameInput = document.getElementById('char-name');
    const colorInput = document.getElementById('char-color');
    const generateBtn = document.getElementById('generate-json-btn');

    function sanitizeId(value) {
        if (!value) return '';
        return value.toLowerCase()
            .replace(/[\s-]+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
    }

    function handleFileUpload(e, key) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            document.getElementById(`preview-${key}`).src = dataUrl;
            document.getElementById(`slot-${key}`).classList.add('filled');
            characterState.poses[key] = `NEEDS_REPLACEMENT_WITH_PATH/static/character_images/${characterState.id || 'char_id'}/${key}.png`;
        };
        reader.readAsDataURL(file);
    }
    
    idInput.addEventListener('input', () => {
        const sanitized = sanitizeId(idInput.value);
        idInput.value = sanitized;
        characterState.id = sanitized;
    });

    nameInput.addEventListener('input', () => {
        characterState.name = nameInput.value;
    });

    colorInput.addEventListener('input', () => {
        characterState.color = colorInput.value;
    });

    poseKeys.forEach(key => {
        document.getElementById(`file-${key}`).addEventListener('change', (e) => handleFileUpload(e, key));
    });

    generateBtn.addEventListener('click', () => {
        let missingPoses = [];
        poseKeys.forEach(key => {
            if (!characterState.poses[key]) {
                missingPoses.push(key);
            }
        });

        if (!characterState.id || !characterState.name || missingPoses.length > 0) {
            let errorMessage = 'Пожалуйста, заполните все поля.\n';
            if (!characterState.id) errorMessage += '- ID персонажа\n';
            if (!characterState.name) errorMessage += '- Имя персонажа\n';
            if (missingPoses.length > 0) errorMessage += `- Отсутствуют изображения для: ${missingPoses.join(', ')}\n`;
            alert(errorMessage);
            return;
        }

        const finalJson = {
            "characters": {
                [characterState.id]: {
                    "name": characterState.name,
                    "color": characterState.color,
                    "poses": {
                        "neutral": `/static/character_images/${characterState.id}/neutral.png`,
                        "happy": `/static/character_images/${characterState.id}/happy.png`,
                        "sad": `/static/character_images/${characterState.id}/sad.png`,
                        "angry": `/static/character_images/${characterState.id}/angry.png`,
                        "shy": `/static/character_images/${characterState.id}/shy.png`,
                        "curious": `/static/character_images/${characterState.id}/curious.png`
                    }
                }
            }
        };

        const blob = new Blob([JSON.stringify(finalJson, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${characterState.id}_char.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert(`Файл ${characterState.id}_char.json сгенерирован!\n\nНе забудьте:\n1. Создать папку /static/character_images/${characterState.id}/\n2. Сохранить туда ваши 6 изображений под правильными именами (neutral.png, happy.png и т.д.).`);
    });
});