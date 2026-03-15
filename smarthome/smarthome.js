import { SmartHomeView } from './smarthome.view.js';
import { SmartHomeData } from './smarthome.data.js';
import { SmartHomeGroups } from './smarthome.groups.js';
import { SmartHomeEditor } from './smarthome.editor.js';
import { SmartHomeTheme } from './smarthome.theme.js';
import { RoomDesigner } from './roomdesigner/roomdesigner.js';

// Falls SmartHomeView andere Klassen braucht, injizieren wir sie hier:
SmartHomeView.Data = SmartHomeData;
SmartHomeView.Groups = SmartHomeGroups;
SmartHomeView.Editor = SmartHomeEditor;
SmartHomeView.Theme = SmartHomeTheme;
SmartHomeView.RoomDesigner = RoomDesigner;

// GLOBAL EXPORT
window.SmartHomeView = SmartHomeView;
