import * as THREE from 'three';
import { MindARThree } from 'mindar-face-three';
import { saveKiss, subscribeToKisses } from './src/firebase.js';
import { UIControl } from "./src/UIControl.js";

const dialogues = [
    "El querer no tiene horario, ni fecha en el calendario.",
    "El amor no reclama posesiones, sino que da libertad.",
    "“El amor lo perdona todo”, hasta aguantar malos tratos.",
    "Ese mes, Febrero, lo inventó un casamentero.",
    "Estas manchas de carmín son temporales, pero tatuarte a tu ex es permanente.",
    "No coloquéis a nadie en un pedestal, porque cuando cometa un error la decepción será terrible.",
    "Amar a alguien es darle el poder de destruirte ¿Puedes confiar en que no lo haga?",
    "Aceptamos el amor que creemos merecer",
    "Amar sin miedo a la pérdida"
];

const uiControl = new UIControl(dialogues, 40000);

let mindarThree = null;
let currentTargetPoint = null;
let currentRotation = 0;

// Lista local para guardar los besos recibidos de Firestore y navegar entre ellos
let allKissesData = [];
let currentKissIndex = 0;

// Elementos UI
const startBtn = document.getElementById('start-btn');
const instructionText = document.getElementById('instruction-text');
const arContainer = document.getElementById('ar-container');
const infoCard = document.getElementById('info-card');
const verButton = document.getElementById('ver-button');

// Modal para crear beso
const modal = document.getElementById('kiss-modal');
const nameInput = document.getElementById('kiss-name');
const messageInput = document.getElementById('kiss-message');
const saveKissBtn = document.getElementById('save-kiss-btn');
const cancelKissBtn = document.getElementById('cancel-kiss-btn');

// Cartel para ver mensaje
const viewCard = document.getElementById('view-kiss-card');
const viewName = document.getElementById('view-kiss-name');
const viewMessage = document.getElementById('view-kiss-message');
const closeViewBtn = document.getElementById('close-view-btn');
const nextKissBtn = document.getElementById('next-kiss-btn');

// Función para mostrar el beso actual de la lista ---
const displayKissData = (index) => {
    if (allKissesData.length === 0) {
        viewName.textContent = "Sin besos aún";
        viewMessage.textContent = "¡Sé el primero en dejar un mensaje!";
    } else {
        const kiss = allKissesData[index];
        viewName.textContent = kiss.nombre || "Anónimo";
        viewMessage.textContent = `"${kiss.mensaje || 'Sin mensaje'}"`;
    }
    viewCard.style.display = 'block';
};

// Evento del botón de la carta para abrir y ver el primer beso
verButton.onclick = () => {
    if (modal.style.display === 'flex') return; // No abrir si el modal de creación está activo
    currentKissIndex = 0;
    displayKissData(currentKissIndex);
};

// Evento para avanzar al siguiente beso en la lista de forma cíclica
nextKissBtn.onclick = () => {
    if (allKissesData.length > 0) {
        currentKissIndex = (currentKissIndex + 1) % allKissesData.length;
        displayKissData(currentKissIndex);
    }
};

closeViewBtn.onclick = () => { viewCard.style.display = 'none'; };

const startAR = async () => {
    mindarThree = new MindARThree({
        container: arContainer,
    });

    const { renderer, scene, camera } = mindarThree;

    // 1. Grupo ancla del rostro
    const anchor = mindarThree.addAnchor(168);
    anchor.group.frustumCulled = false;

    // 2. Malla facial para tracking
    const faceGeometry = mindarThree.addFaceMesh();
    if (!faceGeometry.morphAttributes) {
        faceGeometry.morphAttributes = {};
    }

    const faceMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const faceMesh = new THREE.Mesh(faceGeometry, faceMaterial);
    faceMesh.frustumCulled = false;
    scene.add(faceMesh);

    // 3. Textura del beso
    const textureLoader = new THREE.TextureLoader();
    const kissTexture = textureLoader.load('./assets/besos_1.png');

    // 4. Plano de interacción (Ubicado ligeramente hacia atrás en Z para no tapar los besos)
    const raycastPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 1.5),
        new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    raycastPlane.position.z = -0.005;
    raycastPlane.frustumCulled = false;
    anchor.group.add(raycastPlane);

    // Estructuras de datos para gestionar los besos e interacciones
    const renderedKisses = new Map();
    const kissSpritesList = []; // Lista de sprites para raycasting

    // Renderizar o actualizar beso desde Firestore
    const renderKiss = (kissData) => {
        if (renderedKisses.has(kissData.id)) return;

        const spriteMaterial = new THREE.SpriteMaterial({
            map: kissTexture,
            transparent: true,
            depthTest: true
        });
        const kissSprite = new THREE.Sprite(spriteMaterial);
        kissSprite.scale.set(0.12, 0.12, 1);

        kissSprite.position.set(
            kissData.posicion.x,
            kissData.posicion.y,
            kissData.posicion.z + 0.015 // Adelantar en Z respecto al plano
        );
        kissSprite.material.rotation = kissData.rotacion || 0;

        // Guardar la información del mensaje dentro del objeto 3D
        kissSprite.userData = {
            nombre: kissData.nombre || 'Anónimo',
            mensaje: kissData.mensaje || '(Sin mensaje)'
        };

        anchor.group.add(kissSprite);
        renderedKisses.set(kissData.id, kissSprite);
        kissSpritesList.push(kissSprite);
    };

    // Sincronizar en tiempo real con Firestore
    subscribeToKisses((kisses) => {
        allKissesData = kisses;
        kisses.forEach(kiss => {
            if (kiss.posicion) {
                renderKiss(kiss);
            }
        });
    });

    // 5. Raycaster y lógica de selección
    const raycaster = new THREE.Raycaster();

    // AUMENTAR LA SENSIBILIDAD DEL RAYCASTER PARA SPRITES (Crucial para pantallas táctiles)
    raycaster.params.Sprite = { threshold: 0.05 };

    const mouse = new THREE.Vector2();

    const onPointerDown = (event) => {
        if (modal.style.display === 'flex' || viewCard.style.display === 'block') return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // PRIMERO: Verificar si el usuario tocó un beso existente
        const kissIntersects = raycaster.intersectObjects(kissSpritesList, false);

        if (kissIntersects.length > 0) {
            const touchedKiss = kissIntersects[0].object;

            // Buscar el índice del beso tocado para que la navegación 'Siguiente Beso' empiece desde allí
            const foundIndex = allKissesData.findIndex(
                k => k.nombre === touchedKiss.userData.nombre && k.mensaje === touchedKiss.userData.mensaje
            );
            currentKissIndex = foundIndex !== -1 ? foundIndex : 0;

            displayKissData(currentKissIndex);
            return;
        }

        // SEGUNDO: Si no tocó un beso, verificar si tocó la cara para dejar uno nuevo
        const planeIntersects = raycaster.intersectObject(raycastPlane);

        if (planeIntersects.length > 0) {
            viewCard.style.display = 'none'; // Ocultar la tarjeta de lectura si estaba abierta
            const hit = planeIntersects[0];
            const point = hit.point.clone();

            anchor.group.worldToLocal(point);

            currentTargetPoint = point;
            currentRotation = (Math.random() - 0.5) * 0.4;

            modal.style.display = 'flex';
        }
    };

    window.addEventListener('pointerdown', onPointerDown);

    // Guardar beso
    saveKissBtn.onclick = async () => {
        const name = nameInput.value.trim();
        const message = messageInput.value.trim();

        if (currentTargetPoint) {
            await saveKiss(name, message, currentTargetPoint, currentRotation);
        }

        nameInput.value = '';
        messageInput.value = '';
        modal.style.display = 'none';
    };

    cancelKissBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // 6. Iniciar MindAR
    await mindarThree.start();

    renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
    });
};

startBtn.addEventListener('click', () => {
    startBtn.style.display = 'none';

    if (infoCard) {
        infoCard.style.display = 'none';
    }

    verButton.style.display = 'flex';

    uiControl.startAutoDialogues();
    instructionText.style.display = 'block';
    startAR();
});