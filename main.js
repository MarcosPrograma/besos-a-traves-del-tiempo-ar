import { dialogues } from './src/dialogues.js';
import { saveKiss, subscribeToKisses } from './src/firebase.js';
import { UIControl, setupDOMUI } from "./src/UIControl.js";
import { createARScene } from "./src/scene.js";

const uiControl = new UIControl(dialogues, 40000);

// Lista local para guardar los besos recibidos de Firestore y navegar entre ellos
let allKissesData = [];

let currentTargetPoint = null;
let currentRotation = 0;
let currentKissIndex = 0;
let isExperienceStarted = false;

// Elementos UI
const startBtn = document.getElementById('start-btn');
const instructionText = document.getElementById('instruction-text');
const arContainer = document.getElementById('ar-container');
const infoCard = document.getElementById('info-card');
const verButton = document.getElementById('ver-button');

// Modal para crear beso
const modal = document.getElementById('kiss-modal');

// Modal para ver beso con mensaje
const viewCard = document.getElementById('view-kiss-card');

const domUI = setupDOMUI(
    () => allKissesData,
    async (name, message) => {
        if (currentTargetPoint) {
            await saveKiss(name, message, currentTargetPoint, currentRotation, currentKissIndex);
        }
    },
    () => isExperienceStarted
);

const arScene = createARScene(
    arContainer,
    (userData) => {
        const foundIndex = allKissesData.findIndex(
            k => k.nombre === userData.nombre && k.mensaje === userData.mensaje
        );
        const index = foundIndex !== -1 ? foundIndex : 0;
        domUI.setCurrentKissIndex(index);
        domUI.displayKissData(index);
    },
    (point, rotation, kissIndex) => {
        domUI.hideViewCard();
        currentTargetPoint = point;
        currentRotation = rotation;
        currentKissIndex = kissIndex;
        domUI.showModal();
    }
);

window.addEventListener('pointerdown', (e) => {
    if (!isExperienceStarted) return;
    arScene.handlePointerDown(e, () => modal.style.display === 'flex' || viewCard.style.display === 'block');
});

subscribeToKisses((kisses) => {
    allKissesData = kisses;
    kisses.forEach(kiss => {
        if (kiss.posicion) {
            arScene.renderKiss(kiss);
        }
    });
});

startBtn.addEventListener('click', () => {
    isExperienceStarted = true;
    startBtn.style.display = 'none';

    if (infoCard) {
        infoCard.style.display = 'none';
    }

    verButton.style.display = 'flex';

    uiControl.startAutoDialogues();
    instructionText.style.display = 'block';
    arScene.start();
});