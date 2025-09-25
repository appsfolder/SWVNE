from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import json
import os
import glob
import uuid
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
        self.voices = {}
        self.scenarios = {}
        self.load_all_content()

    def load_all_content(self):
        """Сканирует папки и загружает весь контент из JSON файлов."""
        self.characters = self._load_from_directory(os.path.join(self.content_path, 'characters'), 'characters')
        self.scenes = self._load_from_directory(os.path.join(self.content_path, 'scenes'), 'scenes')
        self.scenarios = self._load_from_directory(os.path.join(self.content_path, 'scenarios'), 'scenarios')
        self.voices = self._load_from_directory(os.path.join(self.content_path, 'voices'), 'voices')
        
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
        elif content_type == 'voices':
             self.voices = self._load_from_directory(os.path.join(self.content_path, 'voices'), 'voices')

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

@app.route('/api/auth/status')
def auth_status():
    """Check if user is authenticated as admin."""
    return jsonify({
        'authenticated': check_admin(),
        'admin': check_admin()
    })

@app.route('/api/auth/login', methods=['POST'])
def api_login():
    """API endpoint for admin login."""
    try:
        password = request.json.get('password', '')
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        
        if password_hash == ADMIN_PASSWORD_HASH:
            session['admin_logged_in'] = True
            return jsonify({'success': True, 'message': 'Авторизация успешна'})
        else:
            return jsonify({'success': False, 'error': 'Неверный пароль'}), 401
            
    except Exception as e:
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

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
    # SECURITY: Require admin authentication
    if not check_admin():
        return jsonify({'success': False, 'error': 'Доступ запрещён', 'requires_auth': True}), 403
        
    try:
        scenario_data = request.json
        
        if not scenario_data or 'scenarios' not in scenario_data:
            return jsonify({'success': False, 'error': 'Неверный формат данных'}), 400
            
        scenario_id = list(scenario_data['scenarios'].keys())[0]
        if not scenario_id:
            return jsonify({'success': False, 'error': 'ID сценария не найден'}), 400
        
        # SECURITY: Validate scenario_id to prevent path traversal
        if not scenario_id.replace('_', '').replace('-', '').isalnum() or len(scenario_id) > 50:
            return jsonify({'success': False, 'error': 'Недопустимые символы в ID сценария'}), 400
        
        # SECURITY: Use secure_filename for additional protection
        safe_scenario_id = secure_filename(scenario_id)
        if not safe_scenario_id:
            return jsonify({'success': False, 'error': 'Недопустимый ID сценария'}), 400
            
        scenarios_dir = os.path.join(content_dir, 'scenarios')
        if not os.path.exists(scenarios_dir):
            os.makedirs(scenarios_dir)
        file_path = os.path.join(scenarios_dir, f'{safe_scenario_id}.json')
        
        # SECURITY: Validate that the path is within the expected directory
        if not os.path.abspath(file_path).startswith(os.path.abspath(scenarios_dir)):
            return jsonify({'success': False, 'error': 'Недопустимый путь к файлу'}), 400
            
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(scenario_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'message': f'Сценарий "{safe_scenario_id}" сохранен успешно'})
        
    except Exception as e:
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

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
        # SECURITY: Validate scenario_id to prevent path traversal
        if not scenario_id.replace('_', '').replace('-', '').isalnum() or len(scenario_id) > 50:
            return jsonify({'error': 'Недопустимые символы в ID сценария'}), 400
        
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
        return jsonify({'error': 'Ошибка сервера'}), 500

@app.route('/api/characters/save', methods=['POST'])
def save_character():
    """Save character data to file."""
    # SECURITY: Require admin authentication for character modifications
    if not check_admin():
        return jsonify({'success': False, 'error': 'Доступ запрещён', 'requires_auth': True}), 403
        
    try:
        character_data = request.json.get('characters', {})
        
        if not character_data:
            return jsonify({'success': False, 'error': 'Неверные данные персонажа'}), 400
            
        character_id = list(character_data.keys())[0]
        if not character_id:
            return jsonify({'success': False, 'error': 'ID персонажа не найден'}), 400
        
        # SECURITY: Validate character_id to prevent path traversal
        if not character_id.replace('_', '').replace('-', '').isalnum() or len(character_id) > 50:
            return jsonify({'success': False, 'error': 'Недопустимые символы в ID персонажа'}), 400
        
        # Create characters directory if it doesn't exist
        characters_dir = os.path.join(content_dir, 'characters')
        if not os.path.exists(characters_dir):
            os.makedirs(characters_dir)
        
        # Load existing characters
        chars_file = os.path.join(characters_dir, 'chars.json')
        existing_data = {'characters': {}}
        if os.path.exists(chars_file):
            with open(chars_file, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        
        # Update with new character
        existing_data['characters'].update(character_data)
        
        # Save to characters file
        with open(chars_file, 'w', encoding='utf-8') as f:
            json.dump(existing_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'message': f'Персонаж "{character_id}" сохранён успешно'})
        
    except Exception as e:
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/api/characters/upload-image', methods=['POST'])
def upload_character_image():
    """Upload character pose image."""
    # SECURITY: Require admin authentication for character modifications
    if not check_admin():
        return jsonify({'success': False, 'error': 'Доступ запрещён', 'requires_auth': True}), 403
        
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'Файл не найден'}), 400
        
        file = request.files['image']
        character_id = request.form.get('character_id')
        pose_name = request.form.get('pose_name')
        
        if not character_id or not pose_name:
            return jsonify({'success': False, 'error': 'Не указан ID персонажа или название позы'}), 400
        
        # SECURITY: Validate inputs
        if not character_id.replace('_', '').replace('-', '').isalnum() or len(character_id) > 50:
            return jsonify({'success': False, 'error': 'Недопустимые символы в ID персонажа'}), 400
        
        if not pose_name.replace('_', '').isalnum() or len(pose_name) > 20:
            return jsonify({'success': False, 'error': 'Недопустимые символы в названии позы'}), 400
        
        if file.filename == '':
            return jsonify({'success': False, 'error': 'Файл не выбран'}), 400
        
        # SECURITY: Validate file extension
        allowed_extensions = {'png', 'jpg', 'jpeg', 'webp'}
        file_ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        if file_ext not in allowed_extensions:
            return jsonify({'success': False, 'error': 'Недопустимый формат файла. Используйте PNG, JPG, JPEG или WEBP'}), 400
        
        # Create character images directory
        safe_character_id = secure_filename(character_id)
        safe_pose_name = secure_filename(pose_name)
        
        character_dir = os.path.join('static', 'character_images', safe_character_id)
        os.makedirs(character_dir, exist_ok=True)
        
        # Save with .png extension for consistency
        filename = f"{safe_pose_name}.png"
        filepath = os.path.join(character_dir, filename)
        
        # SECURITY: Validate that the path is within the expected directory
        if not os.path.abspath(filepath).startswith(os.path.abspath(character_dir)):
            return jsonify({'success': False, 'error': 'Недопустимый путь к файлу'}), 400
            
        file.save(filepath)
        
        # Return the relative path for the frontend
        relative_path = f"/static/character_images/{safe_character_id}/{filename}"
        
        return jsonify({
            'success': True, 
            'message': 'Изображение загружено успешно',
            'path': relative_path
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/api/characters/list')
def list_characters():
    """Get list of existing characters."""
    try:
        manager = VisualNovelManager(content_dir)
        characters_list = []
        
        for char_id, char_data in manager.characters.items():
            characters_list.append({
                'id': char_id,
                'name': char_data.get('name', char_id),
                'color': char_data.get('color', '#000000'),
                'poses': list(char_data.get('poses', {}).keys()) if 'poses' in char_data else []
            })
        
        return jsonify({'characters': characters_list})
        
    except Exception as e:
        return jsonify({'error': 'Ошибка сервера'}), 500

# Asset management routes
@app.route('/asset-editor')
def asset_editor():
    """Asset editor page."""
    return render_template('asset_editor.html')

@app.route('/api/assets/list')
def list_assets():
    """Get list of available assets (BGM, SFX, scenes)."""
    try:
        assets = {
            'bgm': [],
            'sfx': [],
            'locations': []
        }
        
        # Scan BGM files
        bgm_dir = os.path.join('static', 'audio', 'bgm')
        if os.path.exists(bgm_dir):
            for filename in os.listdir(bgm_dir):
                if filename.lower().endswith(('.mp3', '.ogg', '.wav')):
                    filepath = os.path.join(bgm_dir, filename)
                    assets['bgm'].append({
                        'name': filename,
                        'path': f'/static/audio/bgm/{filename}',
                        'size': os.path.getsize(filepath)
                    })
        
        # Scan SFX files
        sfx_dir = os.path.join('static', 'audio', 'sfx')
        if os.path.exists(sfx_dir):
            for filename in os.listdir(sfx_dir):
                if filename.lower().endswith(('.mp3', '.ogg', '.wav')):
                    filepath = os.path.join(sfx_dir, filename)
                    assets['sfx'].append({
                        'name': filename,
                        'path': f'/static/audio/sfx/{filename}',
                        'size': os.path.getsize(filepath)
                    })
        
        # Load location files from content/scenes/locations.json
        locations_json_path = os.path.join(content_dir, 'scenes', 'locations.json')
        if os.path.exists(locations_json_path):
            try:
                with open(locations_json_path, 'r', encoding='utf-8') as f:
                    locations_data = json.load(f)
                
                for location_id, location_info in locations_data.get('scenes', {}).items():
                    background_path = location_info.get('background', '')
                    if background_path.startswith('/static/locations/'):
                        filename = background_path.split('/')[-1]
                        filepath = os.path.join('static', 'locations', filename)
                        
                        if os.path.exists(filepath):
                            assets['locations'].append({
                                'id': location_id,
                                'name': location_info.get('name', location_id),
                                'filename': filename,
                                'path': background_path,
                                'size': os.path.getsize(filepath)
                            })
            except (json.JSONDecodeError, Exception) as e:
                print(f"Error reading locations.json: {e}")
        
        return jsonify({'success': True, 'assets': assets})
        
    except Exception as e:
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/api/assets/upload', methods=['POST'])
def upload_asset():
    """Upload asset file (audio or image)."""
    # SECURITY: Require admin authentication
    if not check_admin():
        return jsonify({'success': False, 'error': 'Доступ запрещён', 'requires_auth': True}), 403
        
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'Файл не найден'}), 400
        
        file = request.files['file']
        asset_type = request.form.get('type')  # 'bgm', 'sfx', or 'scenes'
        
        if not asset_type or asset_type not in ['bgm', 'sfx', 'locations']:
            return jsonify({'success': False, 'error': 'Неверный тип ресурса'}), 400
        
        if file.filename == '':
            return jsonify({'success': False, 'error': 'Файл не выбран'}), 400
        
        # SECURITY: Validate file extension based on type
        if asset_type in ['bgm', 'sfx']:
            allowed_extensions = {'mp3', 'ogg', 'wav'}
            target_dir = os.path.join('static', 'audio', asset_type)
        else:  # locations
            allowed_extensions = {'png', 'jpg', 'jpeg', 'webp'}
            target_dir = os.path.join('static', 'locations')
        
        file_ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        if file_ext not in allowed_extensions:
            return jsonify({'success': False, 'error': f'Недопустимый формат файла для {asset_type}'}), 400
        
        # SECURITY: Use secure_filename and additional sanitization
        safe_filename = secure_filename(file.filename)
        if not safe_filename:
            return jsonify({'success': False, 'error': 'Недопустимое имя файла'}), 400
        
        # Create target directory if it doesn't exist
        os.makedirs(target_dir, exist_ok=True)
        
        filepath = os.path.join(target_dir, safe_filename)
        
        # SECURITY: Validate that the path is within the expected directory
        if not os.path.abspath(filepath).startswith(os.path.abspath(target_dir)):
            return jsonify({'success': False, 'error': 'Недопустимый путь к файлу'}), 400
        
        # Check if file already exists
        if os.path.exists(filepath):
            return jsonify({'success': False, 'error': 'Файл с таким именем уже существует'}), 400
        
        file.save(filepath)
        
        # Return the relative path
        if asset_type in ['bgm', 'sfx']:
            relative_path = f'/static/audio/{asset_type}/{safe_filename}'
        else:
            relative_path = f'/static/locations/{safe_filename}'
            
            # For locations, also update content/scenes/locations.json
            try:
                locations_json_path = os.path.join(content_dir, 'scenes', 'locations.json')
                
                # Load existing locations
                locations_data = {'scenes': {}}
                if os.path.exists(locations_json_path):
                    with open(locations_json_path, 'r', encoding='utf-8') as f:
                        locations_data = json.load(f)
                
                # Generate unique location ID as UUID (limited to 30 characters)
                location_id = str(uuid.uuid4()).replace('-', '')[:30]
                
                # Ensure unique ID (though UUID collision is extremely unlikely)
                while location_id in locations_data['scenes']:
                    location_id = str(uuid.uuid4()).replace('-', '')[:30]
                
                # Add new location entry
                locations_data['scenes'][location_id] = {
                    'name': os.path.splitext(safe_filename)[0].replace('_', ' ').title(),
                    'background': relative_path
                }
                
                # Create directory if it doesn't exist
                os.makedirs(os.path.dirname(locations_json_path), exist_ok=True)
                
                # Save updated locations.json
                with open(locations_json_path, 'w', encoding='utf-8') as f:
                    json.dump(locations_data, f, ensure_ascii=False, indent=2)
                    
            except Exception as e:
                print(f"Error updating locations.json: {e}")
                # Don't fail the upload if JSON update fails
        
        return jsonify({
            'success': True, 
            'message': 'Файл загружен успешно',
            'path': relative_path,
            'name': safe_filename,
            'size': os.path.getsize(filepath)
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/api/assets/delete', methods=['POST'])
def delete_asset():
    """Delete asset file."""
    # SECURITY: Require admin authentication
    if not check_admin():
        return jsonify({'success': False, 'error': 'Доступ запрещён', 'requires_auth': True}), 403
        
    try:
        data = request.get_json()
        if not data or 'type' not in data or 'path' not in data:
            return jsonify({'success': False, 'error': 'Неверные параметры'}), 400
        
        asset_type = data['type']
        asset_path = data['path']
        
        if asset_type not in ['bgm', 'sfx', 'locations']:
            return jsonify({'success': False, 'error': 'Неверный тип ресурса'}), 400
        
        # SECURITY: Validate path format
        if asset_type in ['bgm', 'sfx']:
            expected_prefix = f'/static/audio/{asset_type}/'
            base_dir = os.path.join('static', 'audio', asset_type)
        else:
            expected_prefix = '/static/locations/'
            base_dir = os.path.join('static', 'locations')
        
        if not asset_path.startswith(expected_prefix):
            return jsonify({'success': False, 'error': 'Недопустимый путь к файлу'}), 400
        
        # Extract filename and construct full path
        filename = asset_path[len(expected_prefix):]
        safe_filename = secure_filename(filename)
        
        if not safe_filename or safe_filename != filename:
            return jsonify({'success': False, 'error': 'Недопустимое имя файла'}), 400
        
        full_path = os.path.join(base_dir, safe_filename)
        
        # SECURITY: Validate that the path is within the expected directory
        if not os.path.abspath(full_path).startswith(os.path.abspath(base_dir)):
            return jsonify({'success': False, 'error': 'Недопустимый путь к файлу'}), 400
        
        if not os.path.exists(full_path):
            return jsonify({'success': False, 'error': 'Файл не найден'}), 404
        
        os.remove(full_path)
        
        # For locations, also remove from content/scenes/locations.json
        if asset_type == 'locations':
            try:
                locations_json_path = os.path.join(content_dir, 'scenes', 'locations.json')
                
                if os.path.exists(locations_json_path):
                    with open(locations_json_path, 'r', encoding='utf-8') as f:
                        locations_data = json.load(f)
                    
                    # Find and remove the location entry that matches this path
                    scenes_to_remove = []
                    for location_id, location_info in locations_data.get('scenes', {}).items():
                        if location_info.get('background') == asset_path:
                            scenes_to_remove.append(location_id)
                    
                    # Remove found entries
                    for location_id in scenes_to_remove:
                        del locations_data['scenes'][location_id]
                    
                    # Save updated locations.json
                    with open(locations_json_path, 'w', encoding='utf-8') as f:
                        json.dump(locations_data, f, ensure_ascii=False, indent=2)
                        
            except Exception as e:
                print(f"Error updating locations.json during deletion: {e}")
                # Don't fail the deletion if JSON update fails
        
        return jsonify({
            'success': True, 
            'message': 'Файл удален успешно'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/api/assets/update-location', methods=['POST'])
def update_location_name():
    """Update location name in locations.json."""
    # SECURITY: Require admin authentication
    if not check_admin():
        return jsonify({'success': False, 'error': 'Доступ запрещён', 'requires_auth': True}), 403
        
    try:
        data = request.get_json()
        if not data or 'location_id' not in data or 'new_name' not in data:
            return jsonify({'success': False, 'error': 'Неверные параметры'}), 400
        
        location_id = data['location_id']
        new_name = data['new_name'].strip()
        
        if not new_name:
            return jsonify({'success': False, 'error': 'Имя локации не может быть пустым'}), 400
        
        # SECURITY: Validate location_id (UUID format, max 30 chars)
        if not location_id.isalnum() or len(location_id) > 30:
            return jsonify({'success': False, 'error': 'Недопустимый ID локации'}), 400
        
        locations_json_path = os.path.join(content_dir, 'scenes', 'locations.json')
        
        if not os.path.exists(locations_json_path):
            return jsonify({'success': False, 'error': 'Файл локаций не найден'}), 404
        
        # Load existing locations
        with open(locations_json_path, 'r', encoding='utf-8') as f:
            locations_data = json.load(f)
        
        if location_id not in locations_data.get('scenes', {}):
            return jsonify({'success': False, 'error': 'Локация не найдена'}), 404
        
        # Update the name
        locations_data['scenes'][location_id]['name'] = new_name
        
        # Save updated locations.json
        with open(locations_json_path, 'w', encoding='utf-8') as f:
            json.dump(locations_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'success': True, 
            'message': 'Имя локации обновлено успешно'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': 'Ошибка сервера'}), 500

@app.route('/character-creator')
def character_creator():
    """Отдаёт страницу редактора персонажей."""
    manager = VisualNovelManager(content_dir)
    voices_data = manager.voices
    voices_json = json.dumps(voices_data)

    return render_template('character_creator.html', voices_json=voices_json)


if __name__ == '__main__':
    if not os.path.exists(content_dir):
        os.makedirs(content_dir)
    app.run(debug=config['debug'], host=config['host'], port=config['port'])