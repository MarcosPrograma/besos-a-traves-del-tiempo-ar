import { dialogues } from './src/dialogues.js';
import { saveKiss, subscribeToKisses } from './src/firebase.js';
import { UIControl, setupDOMUI } from "./src/UIControl.js";
import { createARScene } from "./src/scene.js";

const uiControl = new UIControl(dialogues, 40000);

let allKissesData = [];
let currentTargetPoint = null;
let currentRotation = 0;
let currentKissIndex = 0;
let isExperienceStarted = false;

const startBtn = document.getElementById('start-btn');
const instructionText = document.getElementById('instruction-text');
const arContainer = document.getElementById('ar-container');
const infoCard = document.getElementById('info-card');
const verButton = document.getElementById('ver-button');

const modal = document.getElementById('kiss-modal');
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

// Delegación global de interacción por puntero/toque
window.addEventListener('pointerdown', (e) => {
    if (!isExperienceStarted) return;

    // Si la interacción ocurre dentro de modales o botones HTML, se descarta el raycast
    if (e.target.closest('#ui-container') || 
        e.target.closest('#kiss-modal') || 
        e.target.closest('#view-kiss-card') || 
        e.target.closest('#ver-button') ||
        e.target.closest('#logo-link')) {
        return;
    }

    arScene.handlePointerDown(
        e, 
        () => modal.style.display === 'flex' || viewCard.style.display === 'block'
    );
});

subscribeToKisses((kisses) => {
    console.log("Besos actualizados desde Firestore:", kisses);
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