import * as THREE from 'three';
import { MindARThree } from 'mindar-face-three';

export function createARScene(container, onKissSelected, onPlaneTouched) {
    // Forzar el uso de la cámara trasera en dispositivos móviles sin modo espejo
    let mindarThree = new MindARThree({
        container: container,
        facingMode: "environment"
    });

    /*if (mindarThree.video) {
        mindarThree.video.style.transform = "none";
    }*/

    const { renderer, scene, camera } = mindarThree;

    // Grupo ancla del rostro
    const anchor = mindarThree.addAnchor(168);
    anchor.group.frustumCulled = false;

    // Malla facial para tracking e interacción
    const faceGeometry = mindarThree.addFaceMesh();
    if (!faceGeometry.morphAttributes) {
        faceGeometry.morphAttributes = {};
    }

    const faceMaterial = new THREE.MeshBasicMaterial({ 
        visible: false,
        side: THREE.DoubleSide
    });
    const faceMesh = new THREE.Mesh(faceGeometry, faceMaterial);
    faceMesh.frustumCulled = false;
    scene.add(faceMesh);
    anchor.group.add(faceMesh);

    //Texturas de los besos
    const textureLoader = new THREE.TextureLoader();
    const kissTextures = [
        textureLoader.load('./assets/besos_1.png'),
        textureLoader.load('./assets/besos_2.png'),
        textureLoader.load('./assets/besos_3.png'),
        textureLoader.load('./assets/besos_4.png'),
        textureLoader.load('./assets/besos_5.png')
    ];

    /* Plano de interacción 
    const raycastPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 1.5),
        new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    raycastPlane.position.z = -0.005; //Detrás del rostro para evitar interferencias
    raycastPlane.frustumCulled = false;
    anchor.group.add(raycastPlane);
    */

    // Estructuras de datos para gestionar los besos e interacciones
    const renderedKisses = new Map();
    const kissSpritesList = [];

    // Renderizar o actualizar beso desde la base de datos (Firestore)
    const renderKiss = (kissData) => {
        if (renderedKisses.has(kissData.id)) return;

        const textureIndex = (kissData.kissIndex !== undefined && kissData.kissIndex < kissTextures.length) ? kissData.kissIndex : 0;
        const selectedTexture = kissTextures[textureIndex];

        const spriteMaterial = new THREE.SpriteMaterial({
            map: selectedTexture,
            transparent: true,
            depthTest: true
        });
        const kissSprite = new THREE.Sprite(spriteMaterial);
        kissSprite.scale.set(0.12, 0.12, 1);

        kissSprite.position.set(
            kissData.posicion.x,
            kissData.posicion.y,
            kissData.posicion.z + 0.015
        );
        kissSprite.material.rotation = kissData.rotacion || 0;

        // Guardar la información del mensaje dentro del objeto 3D
        kissSprite.userData = {
            nombre: kissData.nombre || 'Caballero o Dama Anónima',
            mensaje: kissData.mensaje || '(Un caballero o damisela solo ha dejado un beso sin mensaje)'
        };

        anchor.group.add(kissSprite);
        renderedKisses.set(kissData.id, kissSprite);
        kissSpritesList.push(kissSprite);
    };

    // Raycaster y lógica para ver besos 
    const raycaster = new THREE.Raycaster();
    raycaster.params.Sprite = { threshold: 0.05 };
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event, isModalOrCardOpen) => {
        if (isModalOrCardOpen()) return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // Verificar intersección con los sprites de besos
        const kissIntersects = raycaster.intersectObjects(kissSpritesList, false);

        if (kissIntersects.length > 0) {
            const touchedKiss = kissIntersects[0].object;
            onKissSelected(touchedKiss.userData);
            return;
        }

        // Si no hay intersección con un beso, verificar intersección con el mesh de interacción para dejar beso
        const faceIntersects = raycaster.intersectObject(faceMesh);

        if (faceIntersects.length > 0) {
            const hit = faceIntersects[0];
            const point = hit.point.clone();
            anchor.group.worldToLocal(point);

            const rotation = (Math.random() - 0.5) * 0.4;
            const kissIndex = Math.floor(Math.random() * kissTextures.length);

            onPlaneTouched(point, rotation, kissIndex);
        }
    };

    const start = async () => {
        // Forzar el uso de la cámara trasera en dispositivos móviles sin modo espejo
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

        navigator.mediaDevices.getUserMedia = async (constraints) => {
            if (constraints && constraints.video) {
                constraints.video = {
                    facingMode: { exact: "environment" }
                };
            }

            try {
                return await originalGetUserMedia(constraints);
            } catch (err) {
                console.warn("No se pudo forzar 'exact: environment', reintentando con 'environment' flexible:", err);
                constraints.video.facingMode = "environment";
                return await originalGetUserMedia(constraints);
            }
        };

        navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 },
                focusMode: { ideal: "continuous" }
            }
        });

        try {
            await mindarThree.start();
            if (mindarThree.video) {
                 //mindarThree.video.style.transform = "none";
                 //mindarThree.video.style.objectFit = "cover";
                 mindarThree.video.addEventListener('loadedmetadata', () => {
                    mindarThree.video.style.transform = "none";
                });
            }
        } catch (error) {
            console.error("Error al iniciar la cámara trasera:", error);
            alert("Asegúrate de conceder permisos de cámara");
        } finally {
            navigator.mediaDevices.getUserMedia = originalGetUserMedia;
        }

        renderer.setAnimationLoop(() => {
            renderer.render(scene, camera);
        });
    };

    return {
        start,
        renderKiss,
        handlePointerDown
    };
}