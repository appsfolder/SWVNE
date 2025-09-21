class AdminPanel {
    constructor() {
        this.initializeAdmin();
    }

    initializeAdmin() {
        console.log('Admin panel initialized');
        this.loadContentStats();
    }

    async loadContentStats() {
        try {
            const [charactersRes, scenesRes, scenariosRes] = await Promise.all([
                fetch('/api/content/characters'),
                fetch('/api/content/scenes'),
                fetch('/api/content/scenarios')
            ]);

            const characters = await charactersRes.json();
            const scenes = await scenesRes.json();
            const scenarios = await scenariosRes.json();

            document.getElementById('charactersCount').textContent = Object.keys(characters).length;
            document.getElementById('scenesCount').textContent = Object.keys(scenes).length;
            document.getElementById('scenariosCount').textContent = Object.keys(scenarios).length;
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    showUploadStatus(message, type) { const statusElement = document.getElementById('uploadStatus'); statusElement.textContent = message; statusElement.className = `upload-status ${type}`; setTimeout(() => { statusElement.textContent = ''; statusElement.className = 'upload-status'; }, 5000); }

    async uploadFile(contentType, fileInputId, endpoint) {
        const fileInput = document.getElementById(fileInputId);
        const file = fileInput.files[0];

        if (!file) {
            this.showUploadStatus(`Выберите файл для '${contentType}'`, 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(endpoint, { method: 'POST', body: formData });
            const result = await response.json();
            if (result.success) {
                this.showUploadStatus(result.message, 'success');
                this.loadContentStats();
            } else {
                this.showUploadStatus(result.error || 'Неизвестная ошибка', 'error');
            }
        } catch (error) {
            this.showUploadStatus('Критическая ошибка при загрузке файла', 'error');
            console.error('Upload error:', error);
        }
    }

    uploadCharacters() {
        this.uploadFile('персонажей', 'charactersFile', '/api/admin/content/upload/characters');
    }
    
    uploadScenes() {
        this.uploadFile('сцен', 'scenesFile', '/api/admin/content/upload/scenes');
    }

    uploadScenarios() {
        this.uploadFile('сценариев', 'scenariosFile', '/api/admin/content/upload/scenarios');
    }

    async exportContent(contentType) { try { const response = await fetch(`/api/admin/content/export/${contentType}`); const data = await response.json(); const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${contentType}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); } catch (error) { console.error('Export error:', error); alert('Ошибка при экспорте данных'); } }
}

function showTab(tabName) { document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active')); document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active')); document.getElementById(tabName + 'Tab').classList.add('active'); event.currentTarget.classList.add('active'); }

let adminPanel;
document.addEventListener('DOMContentLoaded', () => { adminPanel = new AdminPanel(); });

function uploadCharacters() { adminPanel.uploadCharacters(); }
function uploadScenes() { adminPanel.uploadScenes(); }
function uploadScenarios() { adminPanel.uploadScenarios(); }
function exportContent(type) { adminPanel.exportContent(type); }