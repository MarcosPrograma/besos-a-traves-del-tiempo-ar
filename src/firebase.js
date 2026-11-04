import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyDcx_flWeNtTWkFe3cij2O-tMNPpq14T-s",
    authDomain: "besos-a-traves-del-tiempo-ar.firebaseapp.com",
    projectId: "besos-a-traves-del-tiempo-ar",
    storageBucket: "besos-a-traves-del-tiempo-ar.firebasestorage.app",
    messagingSenderId: "913096880005",
    appId: "1:913096880005:web:2ee98568cd6b3e9b719eec"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const kissesCollection = collection(db, 'besos');

//Guardar un nuevo beso en Firestore
export const saveKiss = async (name, message, position, rotation, kissIndex) => {
    try {
        await addDoc(kissesCollection, {
            nombre: name || "Caballero o Dama Anónima",
            mensaje: message || "",
            posicion: { x: position.x, y: position.y, z: position.z },
            rotacion: rotation,
            kissIndex: kissIndex,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error al guardar el beso en la base de datos:", error);
    }
};

//Ver los besos guardados
export const subscribeToKisses = (callback) => {
    return onSnapshot(kissesCollection, (snapshot) => {
        const kisses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(kisses);
    });
};