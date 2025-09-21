# SWVNE (Simple Web Visual Novel Engine)

<p align="center">
  <img src="https://img.shields.io/badge/python-3.x-blue.svg" alt="Python 3.x">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License MIT">
  <img src="https://img.shields.io/badge/status-stupid%2C%20but%20fun-orange" alt="Status: stupid, but fun">
</p>

A simple, stupid, but fun web-based visual novel engine built with Flask and vanilla JavaScript. Perfect for creating silly stories with different narratives.

---

<details>
<summary>🇷🇺 <b>Читать на русском</b></summary>

Простой, тупой, но весёлый веб-движок для визуальных новелл, созданный на Flask и чистом JavaScript. Идеально подходит для создания глупых историй с разным сюжетом.

</details>

---

## Table of Contents / Содержание

- [Installation](#installation) / [Установка](#установка)
- [Usage](#usage) / [Использование](#использование)
- [Features](#features) / [Фичи](#фичи)
- [Content Creation](#content-creation) / [Создание контента](#создание-контента)
- [License](#license) / [Лицензия](#лицензия)

## Installation / Установка

First, clone the repository.
```bash
git clone https://github.com/appsfolder/SWVNE.git
cd SWVNE/visual_novel_v3/app
```

It's recommended to use a virtual environment.
```bash
# Create a virtual environment
python -m venv venv

# Activate it
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate
```

Then, install the dependencies.
```bash
pip install -r requirements.txt
```

<details>
<summary>🇷🇺 <b>Инструкция на русском</b></summary>

Сначала клонируйте репозиторий.
```bash
git clone https://github.com/appsfolder/SWVNE.git
cd SWVNE/visual_novel_v3/app
```

Рекомендуется использовать виртуальное окружение.
```bash
# Создаем виртуальное окружение
python -m venv venv

# Активируем его
# На Windows
venv\Scripts\activate
# На macOS/Linux
source venv/bin/activate
```

Затем установите зависимости.
```bash
pip install -r requirements.txt
```

</details>

## Usage / Использование

Just run the `app.py` file.
```bash
python app.py
```
The application will be available at `http://127.0.0.1:5000`.

<details>
<summary>🇷🇺 <b>Инструкция на русском</b></summary>

Просто запустите файл `app.py`.
```bash
python app.py
```
Приложение будет доступно по адресу `http://127.0.0.1:5000`.

</details>

## Features / Фичи

- rat seggs
- more rat seggs
- even more rat seggs
- And a public scenario editor, so you can help us add... more rat seggs.

<details>
<summary>🇷🇺 <b>На русском</b></summary>

- rat seggs
- больше rat seggs
- еще больше rat seggs
- А ещё публичный редактор сценариев, так что вы можете помочь нам добавить... больше rat seggs.

</details>

## Content Creation / Создание контента

You can create your own stories!
- **Scenario Editor:** Go to `/scenario-creator` or use the button in the main menu to access the web-based editor. Create your story, then download the JSON.
- **Manual Creation:** All content (characters, scenes, scenarios) is stored in JSON files within the `config.UPLOAD_FOLDER` directory. Check the existing files for the format.
- **Upload:** Use the admin panel to upload your new scenario file. It will then appear in the "Start Game" menu.

<details>
<summary>🇷🇺 <b>На русском</b></summary>

Вы можете создавать свои собственные истории!
- **Редактор сценариев:** Перейдите по адресу `/scenario-creator` или нажмите на кнопку в главном меню, чтобы открыть веб-редактор. Создайте свою историю, а затем скачайте JSON.
- **Ручное создание:** Весь контент (персонажи, сцены, сценарии) хранится в JSON-файлах в папке `config.UPLOAD_FOLDER`. Посмотрите на существующие файлы, чтобы понять формат.
- **Загрузка:** Используйте админ-панель, чтобы загрузить ваш новый файл сценария. После этого он появится в меню выбора сценариев.

</details>

## License / Лицензия

This project is licensed under the [MIT License](LICENSE). Do whatever you want with it.

<details>
<summary>🇷🇺 <b>На русском</b></summary>

Этот проект лицензирован под [лицензией MIT](LICENSE). Делайте с ним что хотите.

</details>