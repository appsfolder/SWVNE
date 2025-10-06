document.addEventListener('DOMContentLoaded', () => {
    // Asset state
    let assetsState = {
        bgm: [],
        sfx: [],
        locations: []
    };

    // DOM elements
    const refreshBtn = document.getElementById('refresh-assets-btn');
    const exportBtn = document.getElementById('export-assets-btn');
    const importBtn = document.getElementById('import-assets-btn');
    const importInput = document.getElementById('import-assets-input');
    
    // Upload buttons and file inputs
    const uploadBgmBtn = document.getElementById('upload-bgm-btn');
    const uploadSfxBtn = document.getElementById('upload-sfx-btn');
    const uploadLocationsBtn = document.getElementById('upload-locations-btn');
    
    const bgmFileInput = document.getElementById('bgm-file-input');
    const sfxFileInput = document.getElementById('sfx-file-input');
    const locationsFileInput = document.getElementById('locations-file-input');
    
    // Asset grids
    const bgmGrid = document.getElementById('bgm-assets-grid');
    const sfxGrid = document.getElementById('sfx-assets-grid');
    const locationsGrid = document.getElementById('locations-assets-grid');
    
    // Templates
    const audioTemplate = document.getElementById('audio-asset-template');
    const locationTemplate = document.getElementById('location-asset-template');
    
    // Preview modal
    const locationPreviewModal = document.getElementById('location-preview-modal');
    const locationPreviewImage = document.getElementById('location-preview-image');
    const locationPreviewTitle = document.getElementById('location-preview-title');
    const closePreviewBtn = document.getElementById('close-location-preview');
    
    // Progress elements
    const progressDiv = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    // Check for missing critical elements
    const requiredElements = [
        { element: refreshBtn, name: 'refresh-assets-btn' },
        { element: exportBtn, name: 'export-assets-btn' },
        { element: importBtn, name: 'import-assets-btn' },
        { element: importInput, name: 'import-assets-input' },
        { element: uploadBgmBtn, name: 'upload-bgm-btn' },
        { element: uploadSfxBtn, name: 'upload-sfx-btn' },
        { element: uploadLocationsBtn, name: 'upload-locations-btn' },
        { element: bgmFileInput, name: 'bgm-file-input' },
        { element: sfxFileInput, name: 'sfx-file-input' },
        { element: locationsFileInput, name: 'locations-file-input' },
        { element: bgmGrid, name: 'bgm-assets-grid' },
        { element: sfxGrid, name: 'sfx-assets-grid' },
        { element: locationsGrid, name: 'locations-assets-grid' },
        { element: audioTemplate, name: 'audio-asset-template' },
        { element: locationTemplate, name: 'location-asset-template' }
    ];
    
    const missingElements = requiredElements.filter(item => !item.element);
    if (missingElements.length > 0) {
        console.error('Asset Editor: Missing required DOM elements:', missingElements.map(item => item.name));
        if (typeof notifications !== 'undefined') {
            notifications.error('Ошибка инициализации', `Не найдены элементы: ${missingElements.map(item => item.name).join(', ')}`);
        }
        return; // Exit early if critical elements are missing
    }
    
    // Audio player for previews
    const audioPlayer = new Audio();
    let currentPlayingBtn = null;

    // Helper functions
    function showProgress(text) {
        if (progressText) progressText.textContent = text;
        if (progressFill) progressFill.style.width = '0%';
        if (progressDiv) progressDiv.style.display = 'block';
    }

    function updateProgress(percent) {
        if (progressFill) progressFill.style.width = `${percent}%`;
    }

    function hideProgress() {
        if (progressDiv) progressDiv.style.display = 'none';
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function sanitizeFilename(filename) {
        return filename.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
    }

    // Generate UUID (limited to 30 characters) for frontend use if needed
    function generateShortUUID() {
        // Create a UUID-like string using crypto.randomUUID if available, otherwise fallback
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID().replace(/-/g, '').substring(0, 30);
        } else {
            // Fallback UUID generation
            return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            }).substring(0, 30);
        }
    }

    // Audio player management
    function resetAudioPlayer() {
        if (currentPlayingBtn) {
            currentPlayingBtn.textContent = '▶';
            currentPlayingBtn.classList.remove('playing');
            currentPlayingBtn = null;
        }
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }

    audioPlayer.addEventListener('ended', resetAudioPlayer);
    audioPlayer.addEventListener('pause', resetAudioPlayer);

    // Load assets from server
    async function loadAssets() {
        try {
            showProgress('Загрузка ресурсов...');
            
            const response = await fetch('/api/assets/list');
            const result = await response.json();
            
            if (result.success) {
                assetsState = result.assets;
                renderAllAssets();
                notifications.success('Обновление завершено', 'Списки ресурсов обновлены');
            } else {
                throw new Error(result.error || 'Ошибка загрузки ресурсов');
            }
        } catch (error) {
            console.error('Error loading assets:', error);
            notifications.error('Ошибка загрузки', error.message);
        } finally {
            hideProgress();
        }
    }

    // Render all asset grids
    function renderAllAssets() {
        renderAudioAssets('bgm', bgmGrid);
        renderAudioAssets('sfx', sfxGrid);
        renderLocationAssets();
    }

    // Render audio assets (BGM/SFX)
    function renderAudioAssets(type, container) {
        if (!container) {
            console.warn(`Asset Editor: Container for ${type} not found`);
            return;
        }
        container.innerHTML = '';
        const assets = assetsState[type] || [];
        
        if (assets.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'assets-empty';
            emptyDiv.textContent = `Нет загруженных ${type === 'bgm' ? 'фоновых мелодий' : 'звуковых эффектов'}`;
            container.appendChild(emptyDiv);
            return;
        }
        
        assets.forEach(asset => {
            const card = audioTemplate.content.cloneNode(true);
            
            card.querySelector('.asset-name').textContent = asset.name;
            card.querySelector('.asset-path').textContent = asset.path;
            card.querySelector('.asset-size').textContent = formatFileSize(asset.size);
            
            const playBtn = card.querySelector('.play-btn');
            const deleteBtn = card.querySelector('.delete-btn');
            
            // Play/pause functionality
            playBtn.addEventListener('click', () => {
                if (currentPlayingBtn === playBtn) {
                    resetAudioPlayer();
                } else {
                    resetAudioPlayer();
                    audioPlayer.src = asset.path;
                    audioPlayer.play();
                    playBtn.textContent = '❚❚';
                    playBtn.classList.add('playing');
                    currentPlayingBtn = playBtn;
                }
            });
            
            // Delete functionality
            deleteBtn.addEventListener('click', () => deleteAsset(type, asset.path, asset.name));
            
            container.appendChild(card);
        });
    }

    // Render location assets
    function renderLocationAssets() {
        if (!locationsGrid) {
            console.warn('Asset Editor: Locations grid container not found');
            return;
        }
        locationsGrid.innerHTML = '';
        const locations = assetsState.locations || [];
        
        if (locations.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'assets-empty';
            emptyDiv.textContent = 'Нет загруженных локаций';
            locationsGrid.appendChild(emptyDiv);
            return;
        }
        
        locations.forEach(location => {
            const card = locationTemplate.content.cloneNode(true);
            
            // Use location name if available, otherwise use filename
            const displayName = location.name || location.filename || 'Unknown Location';
            const locationId = location.id || 'unknown';
            
            card.querySelector('.asset-name').textContent = displayName;
            card.querySelector('.asset-path').textContent = location.path;
            card.querySelector('.asset-size').textContent = formatFileSize(location.size);
            card.querySelector('.location-image').src = location.path;
            
            const previewBtn = card.querySelector('.preview-btn');
            const editBtn = card.querySelector('.edit-btn');
            const deleteBtn = card.querySelector('.delete-btn');
            
            // Preview functionality
            previewBtn.addEventListener('click', () => {
                locationPreviewTitle.textContent = `Предпросмотр: ${displayName}`;
                locationPreviewImage.src = location.path;
                locationPreviewModal.style.display = 'block';
            });
            
            // Edit functionality (only for locations with IDs)
            if (location.id) {
                editBtn.addEventListener('click', () => editLocationName(location.id, displayName));
            } else {
                editBtn.style.display = 'none'; // Hide edit button for locations without IDs
            }
            
            // Delete functionality - show both name and ID for clarity
            const deleteDisplayName = location.id ? `${displayName} (${locationId})` : displayName;
            deleteBtn.addEventListener('click', () => deleteAsset('locations', location.path, deleteDisplayName));
            
            locationsGrid.appendChild(card);
        });
    }

    // Upload assets
    async function uploadAssets(files, type) {
        if (!files || files.length === 0) return;
        
        try {
            showProgress(`Загрузка ${files.length} файл(ов)...`);
            
            let uploaded = 0;
            let errors = [];
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('type', type);
                
                try {
                    updateProgress((i / files.length) * 100);
                    
                    const response = await fetch('/api/assets/upload', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        uploaded++;
                    } else if (result.requires_auth) {
                        // Handle authentication required - prompt for login
                        const authenticated = await auth.ensureAuthenticated();
                        if (authenticated) {
                            // Retry the upload after authentication
                            const retryResponse = await fetch('/api/assets/upload', {
                                method: 'POST',
                                body: formData
                            });
                            const retryResult = await retryResponse.json();
                            if (retryResult.success) {
                                uploaded++;
                            } else {
                                errors.push(`${file.name}: ${retryResult.error}`);
                            }
                        } else {
                            errors.push(`${file.name}: Авторизация отменена`);
                        }
                    } else {
                        errors.push(`${file.name}: ${result.error}`);
                    }
                } catch (error) {
                    errors.push(`${file.name}: ${error.message}`);
                }
            }
            
            updateProgress(100);
            
            if (uploaded > 0) {
                await loadAssets(); // Refresh asset list
                if (errors.length === 0) {
                    notifications.success('Загрузка завершена', `Загружено ${uploaded} файл(ов)`);
                } else {
                    notifications.warning('Загрузка завершена с ошибками', 
                        `Загружено ${uploaded} файл(ов). Ошибки: ${errors.length}`);
                }
            } else {
                notifications.error('Ошибка загрузки', `Не удалось загрузить файлы:\n${errors.join('\n')}`);
            }
            
        } catch (error) {
            console.error('Upload error:', error);
            notifications.error('Ошибка загрузки', error.message);
        } finally {
            hideProgress();
        }
    }

    // Delete asset
    async function deleteAsset(type, path, name) {
        const shouldDelete = await notifications.confirm('Удаление ресурса', 
            `Удалить "${name}"?\n\nЭто действие нельзя отменить.`);
        
        if (!shouldDelete) return;
        
        try {
            showProgress('Удаление ресурса...');
            
            const response = await fetch('/api/assets/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: type,
                    path: path
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                await loadAssets(); // Refresh asset list
                notifications.success('Удаление завершено', `Ресурс "${name}" удален`);
            } else if (result.requires_auth) {
                // Handle authentication required - prompt for login
                const authenticated = await auth.ensureAuthenticated();
                if (authenticated) {
                    // Retry the delete after authentication
                    await deleteAsset(type, path, name);
                    return;
                }
            } else {
                throw new Error(result.error || 'Ошибка удаления');
            }
            
        } catch (error) {
            console.error('Delete error:', error);
            notifications.error('Ошибка удаления', error.message);
        } finally {
            hideProgress();
        }
    }

    // Edit location name
    async function editLocationName(locationId, currentName) {
        const newName = await notifications.prompt('Редактирование названия локации', 'Введите новое название локации:', currentName);
        
        if (!newName || newName.trim() === '' || newName.trim() === currentName) {
            return; // User cancelled or no change
        }
        
        try {
            showProgress('Обновление названия локации...');
            
            const response = await fetch('/api/assets/update-location', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    location_id: locationId,
                    new_name: newName.trim()
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                await loadAssets(); // Refresh the asset list
                notifications.success('Обновление завершено', `Название локации изменено на "${newName.trim()}"`);
            } else if (result.requires_auth) {
                // Handle authentication required - prompt for login
                const authenticated = await auth.ensureAuthenticated();
                if (authenticated) {
                    // Retry the edit after authentication
                    await editLocationName(locationId, currentName);
                    return;
                }
            } else {
                throw new Error(result.error || 'Ошибка обновления');
            }
            
        } catch (error) {
            console.error('Edit location name error:', error);
            notifications.error('Ошибка обновления', error.message);
        } finally {
            hideProgress();
        }
    }

    // Export assets list
    function exportAssets() {
        const exportData = {
            assets: assetsState,
            exported_at: new Date().toISOString()
        };
        
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `assets_list_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        notifications.success('Экспорт завершён', 'Список ресурсов сохранен в файл');
    }

    // Import assets list (informational only)
    function importAssets(file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!data.assets) {
                    throw new Error('Неверный формат файла. Отсутствует секция "assets".');
                }
                
                // This is informational import - showing what assets should exist
                let message = 'Импортированный список содержит:\n\n';
                
                const bgmCount = (data.assets.bgm || []).length;
                const sfxCount = (data.assets.sfx || []).length;
                const locationsCount = (data.assets.locations || []).length;
                
                message += `BGM: ${bgmCount} файл(ов)\n`;
                message += `SFX: ${sfxCount} файл(ов)\n`;
                message += `Локации: ${locationsCount} файл(ов)\n\n`;
                message += 'Примечание: Это информационный импорт. Сами файлы нужно загружать отдельно.';
                
                notifications.success('Импорт завершён', message);
                
            } catch (error) {
                console.error('Import error:', error);
                notifications.error('Ошибка импорта', error.message);
            } finally {
                importInput.value = '';
            }
        };
        
        reader.readAsText(file);
    }

    // Event listeners with null checks
    if (refreshBtn) refreshBtn.addEventListener('click', loadAssets);
    if (exportBtn) exportBtn.addEventListener('click', exportAssets);
    
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            if (importInput) importInput.click();
        });
    }
    
    if (importInput) {
        importInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                importAssets(file);
            }
        });
    }
    
    // Upload button listeners
    if (uploadBgmBtn && bgmFileInput) {
        uploadBgmBtn.addEventListener('click', () => bgmFileInput.click());
    }
    if (uploadSfxBtn && sfxFileInput) {
        uploadSfxBtn.addEventListener('click', () => sfxFileInput.click());
    }
    if (uploadLocationsBtn && locationsFileInput) {
        uploadLocationsBtn.addEventListener('click', () => locationsFileInput.click());
    }
    
    // File input listeners
    if (bgmFileInput) {
        bgmFileInput.addEventListener('change', (e) => {
            uploadAssets(e.target.files, 'bgm');
            e.target.value = '';
        });
    }
    
    if (sfxFileInput) {
        sfxFileInput.addEventListener('change', (e) => {
            uploadAssets(e.target.files, 'sfx');
            e.target.value = '';
        });
    }
    
    if (locationsFileInput) {
        locationsFileInput.addEventListener('change', (e) => {
            uploadAssets(e.target.files, 'locations');
            e.target.value = '';
        });
    }
    
    // Modal close handlers
    if (closePreviewBtn && locationPreviewModal) {
        closePreviewBtn.addEventListener('click', () => {
            locationPreviewModal.style.display = 'none';
        });
        
        locationPreviewModal.addEventListener('click', (e) => {
            if (e.target === locationPreviewModal) {
                locationPreviewModal.style.display = 'none';
            }
        });
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        resetAudioPlayer();
    });

    // Initialize
    loadAssets();
});