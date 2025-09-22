from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import json
import os
import glob
from werkzeug.utils import secure_filename
import hashlib

with open('config.json', 'r', encoding='utf-8') as f:
    config = json.load(f)

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SECRET_KEY'] = config['SECRET_KEY']
app.config['CONTENT_FOLDER'] = config['CONTENT_FOLDER'] 
app.config['UPLOAD_FOLDER'] = config['UPLOAD_FOLDER']
app.config['MAX_CONTENT_LENGTH'] = config['MAX_CONTENT_LENGTH']

ADMIN_PASSWORD = config['ADMIN_PASS']
ADMIN_PASSWORD_HASH = hashlib.sha256(ADMIN_PASSWORD.encode()).hexdigest()

ALLOWED_EXTENSIONS = {'json'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def check_admin():
    return session.get('admin_logged_in', False)

def scan_audio_files(subfolder):
    """Сканирует папку static/audio и возвращает список путей."""
    audio_dir = os.path.join(os.path.dirname(__file__), 'static', 'audio', subfolder)
    if not os.path.exists(audio_dir):
        return []
    
    extensions = ('*.mp3', '*.ogg', '*.wav', '*.m4a')
    files = []
    for ext in extensions:
        files.extend(glob.glob(os.path.join(audio_dir, ext)))
        
    paths = [f"/static/audio/{subfolder}/{os.path.basename(f)}" for f in files]
    return sorted(paths)

class VisualNovelManager:
    def __init__(self, content_path):
        self.content_path = content_path
        self.characters = {}
        self.scenes = {}
        self.scenarios = {}
        self.load_all_content()

    def load_all_content(self):
        """Сканирует папки и загружает весь контент из JSON файлов."""
        self.characters = self._load_from_directory(os.path.join(self.content_path, 'characters'), 'characters')
        self.scenes = self._load_from_directory(os.path.join(self.content_path, 'scenes'), 'scenes')
        self.scenarios = self._load_from_directory(os.path.join(self.content_path, 'scenarios'), 'scenarios') # << ИЗМЕНЕНО
        
        print(f"Loaded {len(self.characters)} characters, {len(self.scenes)} scenes, {len(self.scenarios)} scenarios.")

    def _load_from_directory(self, dir_path, content_key):
        """Вспомогательная функция для загрузки и объединения JSON из папки с улучшенной диагностикой."""
        combined_data = {}
        if not os.path.exists(dir_path):
            os.makedirs(dir_path)
            return {}
            
        for filepath in glob.glob(os.path.join(dir_path, '*.json')):
            filename = os.path.basename(filepath)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if content_key in data:
                        for key in data[content_key]:
                            if key in combined_data:
                                print(f"[WARNING] Duplicate key '{key}' found in {filename}. It will overwrite the existing entry.")
                        combined_data.update(data[content_key])
                    else:
                        print(f"[WARNING] File {filename} was skipped because it does not contain the top-level key '{content_key}'.")
            except json.JSONDecodeError as e:
                print(f"[ERROR] Failed to decode JSON from {filename}: {e}")
            except Exception as e:
                print(f"[ERROR] An unexpected error occurred while loading {filename}: {e}")
        return combined_data

    def reload_content(self, content_type):
        """Перезагружает определенный тип контента."""
        if content_type == 'characters':
             self.characters = self._load_from_directory(os.path.join(self.content_path, 'characters'), 'characters')
        elif content_type == 'scenes':
             self.scenes = self._load_from_directory(os.path.join(self.content_path, 'scenes'), 'scenes')
        elif content_type == 'scenarios':
             self.scenarios = self._load_from_directory(os.path.join(self.content_path, 'scenarios'), 'scenarios')

content_dir = os.path.join(os.path.dirname(__file__), 'content')

@app.route('/')
def index():
    scenario_to_start = request.args.get('scenario', None)
    return render_template('game.html', scenario_to_start=scenario_to_start)

@app.route('/admin')
def admin_login():
    if check_admin():
        return redirect(url_for('admin_panel'))
    return render_template('admin_login.html')

@app.route('/admin/login', methods=['POST'])
def admin_login_post():
    password = request.form.get('password', '')
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if password_hash == ADMIN_PASSWORD_HASH:
        session['admin_logged_in'] = True
        return redirect(url_for('admin_panel'))
    else:
        return render_template('admin_login.html', error='Неверный пароль')

@app.route('/admin/panel')
def admin_panel():
    if not check_admin():
        return redirect(url_for('admin_login'))
    return render_template('admin.html')

@app.route('/admin/logout')
def admin_logout():
    session.pop('admin_logged_in', None)
    return redirect(url_for('index'))

@app.route('/api/content/characters')
def get_characters():
    manager = VisualNovelManager(content_dir)
    return jsonify(manager.characters)

@app.route('/api/content/scenes')
def get_scenes():
    manager = VisualNovelManager(content_dir)
    return jsonify(manager.scenes)

@app.route('/api/content/scenarios')
def get_scenarios():
    manager = VisualNovelManager(content_dir)
    return jsonify(manager.scenarios)

def handle_upload(content_type):
    if not check_admin():
        return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403

    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'Файл не найден'})
    
    file = request.files['file']
    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({'success': False, 'error': 'Недопустимый файл'})

    filename = secure_filename(file.filename)
    upload_path = os.path.join(app.config['UPLOAD_FOLDER'], content_type)
    if not os.path.exists(upload_path):
        os.makedirs(upload_path)
    
    filepath = os.path.join(upload_path, filename)
    file.save(filepath)
    
    return jsonify({'success': True, 'message': f'{content_type.capitalize()} загружены успешно'})

@app.route('/api/admin/content/upload/characters', methods=['POST'])
def admin_upload_characters():
    return handle_upload('characters')

@app.route('/api/admin/content/upload/scenes', methods=['POST'])
def admin_upload_scenes():
    return handle_upload('scenes')

@app.route('/api/admin/content/upload/scenarios', methods=['POST'])
def admin_upload_scenarios():
    return handle_upload('scenarios')


@app.route('/api/admin/content/export/<content_type>')
def admin_export_content(content_type):
    if not check_admin():
        return jsonify({'error': 'Доступ запрещен'}), 403

    manager = VisualNovelManager(content_dir)

    try:
        if content_type == 'characters':
            data = {'characters': manager.characters}
        elif content_type == 'scenes':
            data = {'scenes': manager.scenes}
        elif content_type == 'scenarios':
            data = {'scenarios': manager.scenarios}
        else:
            return jsonify({'error': 'Неизвестный тип контента'}), 400

        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/game/save', methods=['POST'])
def save_game():
    session['saved_game'] = request.json
    return jsonify({'success': True, 'message': 'Игра сохранена в сессии'})

@app.route('/api/game/load', methods=['GET'])
def load_game():
    saved_game = session.get('saved_game', {})
    if not saved_game:
        return jsonify({'currentDialogue': 'start', 'variables': {}, 'history': [], 'currentScenario': None})
    return jsonify(saved_game)

@app.route('/scenario-creator')
def scenario_creator():
    """Отдает страницу визуального редактора сценариев."""
    manager = VisualNovelManager(content_dir)

    characters_data = manager.characters
    scenes_data = manager.scenes
    
    bgm_files = scan_audio_files('bgm')
    sfx_files = scan_audio_files('sfx')

    characters_json = json.dumps(characters_data)
    scenes_json = json.dumps(scenes_data)
    bgm_json = json.dumps(bgm_files)
    sfx_json = json.dumps(sfx_files)
    
    return render_template(
        'scenario_creator.html', 
        characters_json=characters_json, 
        scenes_json=scenes_json,
        bgm_json=bgm_json,
        sfx_json=sfx_json
    )

@app.route('/api/scenarios/save', methods=['POST'])
def save_scenario():
    """Save scenario data to file."""
    try:
        scenario_data = request.json
        
        if not scenario_data or 'scenarios' not in scenario_data:
            return jsonify({'success': False, 'error': 'Неверный формат данных'}), 400
            
        scenario_id = list(scenario_data['scenarios'].keys())[0]
        if not scenario_id:
            return jsonify({'success': False, 'error': 'ID сценария не найден'}), 400
        scenarios_dir = os.path.join(content_dir, 'scenarios')
        if not os.path.exists(scenarios_dir):
            os.makedirs(scenarios_dir)
        file_path = os.path.join(scenarios_dir, f'{scenario_id}.json')
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(scenario_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'message': f'Сценарий "{scenario_id}" сохранен успешно'})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/scenarios/list')
def list_scenarios():
    """Get list of available scenarios."""
    try:
        manager = VisualNovelManager(content_dir)
        scenarios_list = []
        
        for scenario_id, scenario_data in manager.scenarios.items():
            scenarios_list.append({
                'id': scenario_id,
                'title': scenario_data.get('title', scenario_id),
                'description': scenario_data.get('description', ''),
                'author': scenario_data.get('author', ''),
            })
        
        return jsonify({'scenarios': scenarios_list})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/scenarios/load/<scenario_id>')
def load_scenario(scenario_id):
    """Load specific scenario data."""
    try:
        manager = VisualNovelManager(content_dir)
        
        if scenario_id not in manager.scenarios:
            return jsonify({'error': 'Сценарий не найден'}), 404
            
        scenario_data = {
            'scenarios': {
                scenario_id: manager.scenarios[scenario_id]
            }
        }
        
        return jsonify(scenario_data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/character-creator')
def character_creator():
    """Отдает страницу визуального редактора персонажей."""
    return render_template('character_creator.html')


if __name__ == '__main__':
    if not os.path.exists(content_dir):
        os.makedirs(content_dir)
    app.run(debug=config['debug'], host=config['host'], port=config['port'])