# Module: Frontend UI

## Purpose

The Frontend UI module provides Vue 3-based interactive components:
- Character management UI (cards, forms, panels)
- Lobby panels (chat, notes, characters)
- Handbook browser
- Internationalization (EN/RU)
- SignalR integration for real-time updates

**Architecture:** Not a SPA - Multiple Razor view entry points with embedded Vue components

---

## Key Files

### Vue Components

| File | Description | Used In |
|------|-------------|---------|
| [CharacterCard.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/CharacterCard.js) | Character display card | Lobby, CharacterSelect |
| [CharacterFormModal.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/CharacterFormModal.js) | Create/edit character modal | Lobby |
| [LobbyCharacterPanel.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/LobbyCharacterPanel.js) | All characters panel | Lobby |
| [LobbyMyCharacterPanel.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/LobbyMyCharacterPanel.js) | My character panel | Lobby |
| [LobbyChatPanel.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/LobbyChatPanel.js) | Chat panel | Lobby |
| [LobbyMasterNotesPanel.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/LobbyMasterNotesPanel.js) | Master notes panel | Lobby |
| [HandbookContainer.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/HandbookContainer.js) | Handbook main component | Handbook |
| [EntityList.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/EntityList.js) | Entity list | Handbook |
| [EntityDetail.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/EntityDetail.js) | Entity detail view | Handbook |
| [SearchBar.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/SearchBar.js) | Search input | Handbook |
| [TabNavigation.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/TabNavigation.js) | Tab navigation | Handbook |
| [SessionLink.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/SessionLink.js) | Session link display | Browse |
| [LanguageSelector.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/LanguageSelector.js) | Language switcher | Global |

### Composables

| File | Description |
|------|-------------|
| [useCharacterData.js](../../DndSessionManager.Web/wwwroot/ClientApp/composables/useCharacterData.js) | Character data management logic |

### Configuration

| File | Description |
|------|-------------|
| [i18n.js](../../DndSessionManager.Web/wwwroot/ClientApp/i18n.js) | Vue-i18n configuration |
| [main.js](../../DndSessionManager.Web/wwwroot/ClientApp/main.js) | Vue app initialization (if using global app) |

### Localization

| File | Description |
|------|-------------|
| [locales/en.json](../../DndSessionManager.Web/wwwroot/ClientApp/locales/en.json) | English translations |
| [locales/ru.json](../../DndSessionManager.Web/wwwroot/ClientApp/locales/ru.json) | Russian translations |

---

## Vue Component Structure

### Component Export Format

```javascript
// All components use this export pattern
export const component = {
    name: 'ComponentName',
    props: { /* ... */ },
    template: `<!-- HTML template -->`,
    setup(props) {
        // Composition API logic
        return {
            // Exposed reactive data and methods
        };
    }
};

export function setup() {
    // Optional: Global setup logic
}
```

### Example: LobbyChatPanel.js

```javascript
export const component = {
    name: 'LobbyChatPanel',
    props: {
        sessionId: String,
        userId: String
    },
    template: `
        <div class="chat-panel">
            <div class="messages" ref="messagesContainer">
                <div v-for="msg in messages" :key="msg.timestamp" class="message">
                    <strong>{{ msg.username }}:</strong> {{ msg.message }}
                </div>
            </div>
            <div class="input-area">
                <input v-model="newMessage" @keyup.enter="sendMessage" />
                <button @click="sendMessage">Send</button>
            </div>
        </div>
    `,
    setup(props) {
        const messages = ref([]);
        const newMessage = ref('');

        const sendMessage = async () => {
            if (!newMessage.value.trim()) return;
            await lobbyHub.invoke('SendMessage', props.sessionId, props.userId, newMessage.value);
            newMessage.value = '';
        };

        // Listen for incoming messages
        lobbyHub.on('ReceiveMessage', (data) => {
            messages.value.push(data);
        });

        return { messages, newMessage, sendMessage };
    }
};
```

---

## Internationalization (i18n)

### Setup (i18n.js)

```javascript
import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import ru from './locales/ru.json';

export const i18n = createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: { en, ru }
});
```

### Usage in Components

```javascript
export const component = {
    setup() {
        const { t, locale } = useI18n();

        const switchLanguage = (lang) => {
            locale.value = lang;
        };

        return { t, switchLanguage };
    },
    template: `
        <div>
            <h1>{{ t('lobby.title') }}</h1>
            <button @click="switchLanguage('ru')">Русский</button>
        </div>
    `
};
```

### Translation Files

**locales/en.json:**
```json
{
    "lobby": {
        "title": "Game Lobby",
        "chat": "Chat",
        "characters": "Characters"
    },
    "character": {
        "create": "Create Character",
        "edit": "Edit Character",
        "delete": "Delete Character"
    }
}
```

**locales/ru.json:**
```json
{
    "lobby": {
        "title": "Игровое Лобби",
        "chat": "Чат",
        "characters": "Персонажи"
    },
    "character": {
        "create": "Создать Персонажа",
        "edit": "Редактировать Персонажа",
        "delete": "Удалить Персонажа"
    }
}
```

---

## SignalR Integration

### Connection Setup

```javascript
import * as signalR from '@microsoft/signalr';

const lobbyHub = new signalR.HubConnectionBuilder()
    .withUrl('/lobbyHub')
    .withAutomaticReconnect()
    .build();

await lobbyHub.start();
```

### Listening to Events

```javascript
lobbyHub.on('ReceiveMessage', (data) => {
    console.log('New message:', data);
});

lobbyHub.on('CharacterUpdated', (character) => {
    console.log('Character updated:', character);
});
```

### Invoking Server Methods

```javascript
await lobbyHub.invoke('SendMessage', sessionId, userId, message);
await lobbyHub.invoke('CreateCharacter', sessionId, userId, characterData, password);
```

---

## Common Modification Tasks

### Task 1: Add a new Vue component

**Files to create:**

1. **Create component: [NewComponent.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/NewComponent.js)**
   ```javascript
   export const component = {
       name: 'NewComponent',
       props: {
           sessionId: String
       },
       template: `
           <div class="new-component">
               <h2>{{ title }}</h2>
               <p>{{ description }}</p>
           </div>
       `,
       setup(props) {
           const title = ref('New Component');
           const description = ref('This is a new component');

           return { title, description };
       }
   };
   ```

2. **Add to Razor view:**
   ```cshtml
   @section Scripts {
       <script type="module">
           import { component } from '/ClientApp/components/NewComponent.js';
           import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

           const app = createApp(component, {
               sessionId: '@Model.SessionId'
           });

           app.mount('#new-component');
       </script>
   }

   <div id="new-component"></div>
   ```

### Task 2: Add new i18n translations

**Files to modify:**

1. **[locales/en.json](../../DndSessionManager.Web/wwwroot/ClientApp/locales/en.json)**
   ```json
   {
       "newFeature": {
           "title": "New Feature",
           "description": "This is a new feature"
       }
   }
   ```

2. **[locales/ru.json](../../DndSessionManager.Web/wwwroot/ClientApp/locales/ru.json)**
   ```json
   {
       "newFeature": {
           "title": "Новая Функция",
           "description": "Это новая функция"
       }
   }
   ```

3. **Use in component:**
   ```javascript
   const { t } = useI18n();
   const title = t('newFeature.title');
   ```

### Task 3: Add a new composable

**Files to create:**

1. **Create composable: [useNewFeature.js](../../DndSessionManager.Web/wwwroot/ClientApp/composables/useNewFeature.js)**
   ```javascript
   import { ref, computed } from 'vue';

   export function useNewFeature() {
       const data = ref([]);
       const isLoading = ref(false);

       const fetchData = async () => {
           isLoading.value = true;
           try {
               const response = await fetch('/api/data');
               data.value = await response.json();
           } finally {
               isLoading.value = false;
           }
       };

       const filteredData = computed(() => {
           return data.value.filter(item => item.active);
       });

       return {
           data,
           isLoading,
           fetchData,
           filteredData
       };
   }
   ```

2. **Use in component:**
   ```javascript
   import { useNewFeature } from '../composables/useNewFeature.js';

   export const component = {
       setup() {
           const { data, isLoading, fetchData } = useNewFeature();

           onMounted(() => {
               fetchData();
           });

           return { data, isLoading };
       }
   };
   ```

---

## Best Practices

### 1. Reactive Data
```javascript
// Use ref for primitive values
const count = ref(0);

// Use reactive for objects
const user = reactive({ name: 'John', age: 30 });
```

### 2. Computed Properties
```javascript
// Computed values are cached
const fullName = computed(() => `${firstName.value} ${lastName.value}`);
```

### 3. Lifecycle Hooks
```javascript
onMounted(() => {
    console.log('Component mounted');
});

onUnmounted(() => {
    console.log('Component unmounted');
    // Clean up SignalR listeners
    lobbyHub.off('ReceiveMessage');
});
```

### 4. Error Handling
```javascript
try {
    await lobbyHub.invoke('CreateCharacter', data);
} catch (error) {
    console.error('Failed to create character:', error);
    alert('Error creating character');
}
```

---

## Module Dependencies

### Dependencies on other modules:
- **Session Management** → Components interact with session data
- **Character System** → Character components
- **Real-time Communication** → SignalR integration
- **Handbook System** → Handbook components

### Used by:
- All Razor views that need interactive UI
