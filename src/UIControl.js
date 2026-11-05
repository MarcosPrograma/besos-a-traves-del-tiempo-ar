export class UIControl {
    constructor(dialogues, intervalTime = 10000) {
        //elementos DOM
        this.speechBubble = document.getElementById("speech-bubble");
        this.dialogues = dialogues;
        
        //estado del temporizador y diálogos
        this.currentDialogueIndex = 0;
        this.dialogueInterval = null;
        this.intervalTime = intervalTime;

        this.speechTimeout = null;
        this.transitionTimeout = null;

        //estado por ancla/target (para tracking multicara/target)
        this.currentTargetIndex = 0;
        this.targetStates = {};
    }

    _initTargetState(targetIndex) {
        if (!this.targetStates[targetIndex]) {
            this.targetStates[targetIndex] = {
                currentStep: 0,
                isBubbleActive: false
            };
        }
    }

    //iniciar la secuencia de frases
    startAutoDialogues() {
        if (!this.dialogues || this.dialogues.length === 0) return;

        //mostrar la primera frase 
        this.showSpeechBubble(this.currentDialogueIndex);

        //configurar el intervalo para cambiar de frase
        this.dialogueInterval = setInterval(() => {
            this.showNextDialogue();
        }, this.intervalTime);
    }

    //detener la secuencia automática
    stopAutoDialogues() {
        if (this.dialogueInterval) {
            clearInterval(this.dialogueInterval);
            this.dialogueInterval = null;
        }
        this.hideSpeechBubble(true);
    }

    //avanzar al siguiente diálogo
    showNextDialogue() {
        this.currentDialogueIndex = (this.currentDialogueIndex + 1) % this.dialogues.length;
        this.showSpeechBubble(this.currentDialogueIndex);
    }

    //mostrar una burbuja específica
    showSpeechBubble(dialogueIndex, targetIndex = this.currentTargetIndex) {
        const bubble = this.speechBubble;
        if (!bubble || this.dialogues[dialogueIndex] === undefined) return;

        if (targetIndex !== null && targetIndex !== undefined) {
            this._initTargetState(targetIndex);
            this.targetStates[targetIndex].currentStep = dialogueIndex;
            this.targetStates[targetIndex].isBubbleActive = true;
        }

        clearTimeout(this.speechTimeout);
        clearTimeout(this.transitionTimeout);

        bubble.classList.remove("hidden", "visible");
        bubble.textContent = this.dialogues[dialogueIndex];

        requestAnimationFrame(() => {
            bubble.classList.add("visible");
        });

        //ocultar la burbuja a los 7 segundos para dar paso al siguiente ciclo
        this.speechTimeout = setTimeout(() => {
            this.hideSpeechBubble(false, targetIndex);
        }, 7000); 
    }

    hideSpeechBubble(forceImmediate = false, targetIndex = this.currentTargetIndex) {
        const bubble = this.speechBubble;
        if (!bubble) return;

        if (targetIndex !== null && targetIndex !== undefined && this.targetStates[targetIndex]) {
            this.targetStates[targetIndex].isBubbleActive = false;
        }

        clearTimeout(this.speechTimeout);
        clearTimeout(this.transitionTimeout);

        bubble.classList.remove("visible");

        if (forceImmediate) {
            bubble.classList.add("hidden");
        } else {
            //esperar a que finalice el fade-out
            this.transitionTimeout = setTimeout(() => {
                bubble.classList.add("hidden");
            }, 2000);
        }
    }

    /*
    _hideBubbleDOMOnly() {
        const bubble = this.speechBubble;
        if (!bubble) return;
        clearTimeout(this.speechTimeout);
        clearTimeout(this.transitionTimeout);
        bubble.classList.remove("visible");
        bubble.classList.add("hidden");
    }
    */

    onTargetFound(targetIndex) {
        this.currentTargetIndex = targetIndex;
        this._initTargetState(targetIndex);

        const state = this.targetStates[targetIndex];

        //al enfocar el rostro, reanudar diálogos si estaban pausados
        if (!this.dialogueInterval) {
            this.startAutoDialogues();
        } else if (state.isBubbleActive && state.currentStep !== null) {
            this.showSpeechBubble(state.currentStep, targetIndex);
        }
    }

    onTargetLost(targetIndex) {
        this.hideSpeechBubble(true, targetIndex);
    }
}

// -----------------------------------------------

export function setupDOMUI(getKissesData, onSaveKiss, isExperienceStarted) {
    //modal para crear beso
    const modal = document.getElementById('kiss-modal');
    const nameInput = document.getElementById('kiss-name');
    const messageInput = document.getElementById('kiss-message');
    const saveKissBtn = document.getElementById('save-kiss-btn');
    const cancelKissBtn = document.getElementById('cancel-kiss-btn');

    //modal para ver mensajes
    const viewCard = document.getElementById('view-kiss-card');
    const viewName = document.getElementById('view-kiss-name');
    const viewMessage = document.getElementById('view-kiss-message');
    const closeViewBtn = document.getElementById('close-view-btn');
    const nextKissBtn = document.getElementById('next-kiss-btn');
    const verButton = document.getElementById('ver-button');

    let currentKissIndex = 0;

    // Acomodar la vista del modal al abrir el teclado
    const handleInputFocus = (e) => {
        setTimeout(() => {
            e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    };

    nameInput.addEventListener('focus', handleInputFocus);
    messageInput.addEventListener('focus', handleInputFocus);

    //función para mostrar el beso actual
    const displayKissData = (index) => {
        const kisses = getKissesData();
        if (kisses.length === 0) {
            viewName.textContent = "Sin besos aún";
            viewMessage.textContent = "¡Sé el primero en dejar un mensaje!";
        } else {
            const kiss = kisses[index];
            viewName.textContent = kiss.nombre || "Caballero o Dama Anónima";
            viewMessage.textContent = `"${kiss.mensaje || 'Un caballero o damisela solo ha dejado un beso sin mensaje'}"`;
        }
        viewCard.style.display = 'block';
    };

    // botón ver para abrir y leer mensajes 
    verButton.onclick = () => {
        if (!isExperienceStarted() || modal.style.display === 'flex') return;
        currentKissIndex = 0;
        displayKissData(currentKissIndex);
    };

    // botón para avanzar al siguiente beso de forma cíclica
    nextKissBtn.onclick = () => {
        const kisses = getKissesData();
        if (kisses.length > 0) {
            currentKissIndex = (currentKissIndex + 1) % kisses.length;
            displayKissData(currentKissIndex);
        }
    };

    closeViewBtn.onclick = () => { viewCard.style.display = 'none'; };

    //guardar beso 
    saveKissBtn.onclick = async () => {
        const name = nameInput.value.trim();
        const message = messageInput.value.trim();

        if (!message) {
            alert("Por favor, ingresa un mensaje o consejo antes de guardar el beso.");
            messageInput.focus();
            return;
        }

        await onSaveKiss(name, message);

        nameInput.value = '';
        messageInput.value = '';
        modal.style.display = 'none';
    };

    cancelKissBtn.onclick = () => {
        modal.style.display = 'none';
    };

    return {
        displayKissData,
        setCurrentKissIndex: (idx) => { currentKissIndex = idx; },
        hideViewCard: () => { viewCard.style.display = 'none'; },
        showModal: () => { modal.style.display = 'flex'; modal.scrollTop = 0; }
    };
}