import * as THREE from 'three';
import { MindARThree } from 'mindar-face-three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export function createARScene(container, onKissSelected, onPlaneTouched) {
    // Forzar el uso de la cámara trasera en dispositivos móviles sin modo espejo
    let mindarThree = new MindARThree({
        container: container,
        facingMode: "environment",
        disableFaceMirror: true,
        filterMinCF: 0.0001,
        //filterBeta: 0.001
    });

    /*
    if (mindarThree.video) {
        mindarThree.video.style.transform = "none"; 
    }
    */

    const { renderer, scene, camera } = mindarThree;

    // Grupo ancla del rostro
    const anchor = mindarThree.addAnchor(168);
    anchor.group.frustumCulled = false;

    /*
    // Malla facial para tracking
    const faceGeometry = mindarThree.addFaceMesh();
    if (!faceGeometry.morphAttributes) {
        faceGeometry.morphAttributes = {};
    }

    const faceMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const faceMesh = new THREE.Mesh(faceGeometry, faceMaterial);
    faceMesh.frustumCulled = false;
    scene.add(faceMesh);
    */

    let customFaceModel = null;

    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
        './assets/faceGuidarello.glb',
        (gltf) => {
            customFaceModel = gltf.scene;

            customFaceModel.traverse((node) => {
                if (node.isMesh) {
                    node.frustumCulled = false;
                    node.material = new THREE.MeshBasicMaterial({
                        transparent: true,
                        opacity: 0,
                        //color: 0xff007f,
                        //wireframe: true,
                        side: THREE.DoubleSide,
                        depthWrite: false
                    });
                }
            });
            customFaceModel.position.set(0, 0, -0.75);

            anchor.group.add(customFaceModel);
            console.log("Modelo cargado e instalado");
        },
        undefined,
        (error) => {
            console.error("Error al cargar el modelo", error);
        }
    );

    // Texturas de los besos
    const textureLoader = new THREE.TextureLoader();
    const kissTextures = [
        textureLoader.load('./assets/besos_1.png'),
        textureLoader.load('./assets/besos_2.png'),
        textureLoader.load('./assets/besos_3.png'),
        textureLoader.load('./assets/besos_4.png'),
        textureLoader.load('./assets/besos_5.png')
    ];

    kissTextures.forEach(tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
    });

    /*
    // Esfera de interacción
    const sphereGeometry = new THREE.SphereGeometry(0.75, 32, 32);
    const raycastSphere = new THREE.Mesh(
        sphereGeometry,
        new THREE.MeshBasicMaterial({ 
            color: 0x00ff00,
            wireframe: true,
            visible: true, 
            side: THREE.DoubleSide 
        })
    );

    // Centrar la esfera ligeramente hacia atrás para abrazar la cara del ancla
    raycastSphere.position.set(0, 0, -0.5);
    raycastSphere.frustumCulled = false;
    anchor.group.add(raycastSphere);
    */

    // Estructuras de datos para gestionar los besos e interacciones
    const renderedKisses = new Map();
    const kissSpritesList = [];

    // Renderizar o actualizar beso desde la base de datos (Firestore)
    const renderKiss = (kissData) => {
        if (!kissData || !kissData.id || !kissData.posicion) return;
        if (renderedKisses.has(kissData.id)) return;

        //const textureIndex = (kissData.kissIndex !== undefined && kissData.kissIndex < kissTextures.length) ? kissData.kissIndex : 0;
        const rawIndex = parseInt(kissData.kissIndex, 10);
        const textureIndex = (!isNaN(rawIndex) && rawIndex >= 0 && rawIndex < kissTextures.length) ? rawIndex : 0;
        const selectedTexture = kissTextures[textureIndex];

        const spriteMaterial = new THREE.SpriteMaterial({
            map: selectedTexture,
            transparent: true,
            depthTest: true,
            depthWrite: false
        });

        const kissSprite = new THREE.Sprite(spriteMaterial);
        kissSprite.renderOrder = 10;
        kissSprite.scale.set(0.12, 0.12, 1);

        const posX = parseFloat(kissData.posicion.x) || 0;
        const posY = parseFloat(kissData.posicion.y) || 0;
        const posZ = parseFloat(kissData.posicion.z) || 0;

        kissSprite.position.set(posX, posY, posZ, 0.005);
        kissSprite.material.rotation = parseFloat(kissData.rotation) || 0;

        /*
        // Posicionar en la coordenada 3D capturada de la esfera
        kissSprite.position.set(
            kissData.posicion.x,
            kissData.posicion.y,
            kissData.posicion.z + 0.005 // Pequeño offset para evitar Z-fighting con la esfera
        );
        kissSprite.material.rotation = kissData.rotacion || 0;
        */

        // Guardar la información del mensaje dentro del objeto 3D
        kissSprite.userData = {
            id: kissData.id,
            nombre: kissData.nombre || 'Caballero o Dama Anónima',
            mensaje: kissData.mensaje || '(Un caballero o damisela solo ha dejado un beso sin mensaje)'
        };

        anchor.group.add(kissSprite);
        renderedKisses.set(kissData.id, kissSprite);
        kissSpritesList.push(kissSprite);
    };

    // Raycaster y lógica para ver besos 
    const raycaster = new THREE.Raycaster();
    raycaster.params.Sprite = { threshold: 0.15 };
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event, isModalOrCardOpen) => {
        if (isModalOrCardOpen()) return;

        // Normalización exacta en canvas o viewport
        const rect = renderer.domElement.getBoundingClientRect();
        const clientX = event.clientX !== undefined ? event.clientX : (event.touches && event.touches[0] ? event.touches[0].clientX : 0);
        const clientY = event.clientY !== undefined ? event.clientY : (event.touches && event.touches[0] ? event.touches[0].clientY : 0);

        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        scene.updateMatrixWorld(true);
        camera.updateMatrixWorld(true);

        raycaster.setFromCamera(mouse, camera);

        //Verificar intersección con los sprites de besos
        const kissIntersects = raycaster.intersectObjects(kissSpritesList, false);

        if (kissIntersects.length > 0) {
            const touchedKiss = kissIntersects[0].object;
            onKissSelected(touchedKiss.userData);
            return;
        }

        /*
        //Verificar intersección sobre la esfera
        const sphereIntersects = raycaster.intersectObject(raycastSphere);
        
        if (sphereIntersects.length > 0) {
            const hit = sphereIntersects[0];
            const point = hit.point.clone();
            
            // Convertir la posición de colisión a coordenadas locales del ancla
            anchor.group.worldToLocal(point);

            const rotation = (Math.random() - 0.5) * 0.4;
            const kissIndex = Math.floor(Math.random() * kissTextures.length);

            onPlaneTouched(point, rotation, kissIndex);
        }
        */

        if (customFaceModel) {
            customFaceModel.updateMatrixWorld(true);
            anchor.group.updateMatrixWorld(true);

            const modelIntersects = raycaster.intersectObject(customFaceModel, true);

            if (modelIntersects.length > 0) {
                const hit = modelIntersects[0];
                const point = hit.point.clone();

                // Convertir la posición de colisión a coordenadas locales del ancla
                anchor.group.worldToLocal(point);

                const rotation = (Math.random() - 0.5) * 0.4;
                const kissIndex = Math.floor(Math.random() * kissTextures.length);

                onPlaneTouched(point, rotation, kissIndex);
            }
        }
    };

    const start = async () => {
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
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 },
                focusMode: { ideal: "continuous" }
            }
        });

        if (mindarThree.video) {
            mindarThree.video.style.filter = "contrast(1.15) brightness(1.05) sharpen(1.1)";
        }

        try {
            await mindarThree.start();
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