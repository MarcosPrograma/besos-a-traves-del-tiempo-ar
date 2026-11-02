export class UIControl {
    constructor(dialogues, intervalTime = 10000) {
        // Elementos DOM
        this.speechBubble = document.getElementById("speech-bubble");
        this.dialogues = dialogues;
        
        // Estado del temporizador y diálogos
        this.currentDialogueIndex = 0;
        this.dialogueInterval = null;
        this.intervalTime = intervalTime; // Tiempo entre frases (10 seg por defecto)

        this.speechTimeout = null;
        this.transitionTimeout = null;

        // Estado por ancla/target (para tracking multicara/target)
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

    // Iniciar la secuencia automática de frases
    startAutoDialogues() {
        if (!this.dialogues || this.dialogues.length === 0) return;

        // Mostrar la primera frase inmediatamente
        this.showSpeechBubble(this.currentDialogueIndex);

        // Configurar el intervalo para cambiar de frase automáticamente
        this.dialogueInterval = setInterval(() => {
            this.showNextDialogue();
        }, this.intervalTime);
    }

    // Detener la secuencia automática
    stopAutoDialogues() {
        if (this.dialogueInterval) {
            clearInterval(this.dialogueInterval);
            this.dialogueInterval = null;
        }
        this.hideSpeechBubble(true);
    }

    // Avanzar al siguiente diálogo
    showNextDialogue() {
        this.currentDialogueIndex = (this.currentDialogueIndex + 1) % this.dialogues.length;
        this.showSpeechBubble(this.currentDialogueIndex);
    }

    // Mostrar una burbuja específica
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

        // Ocultar suavemente la burbuja a los 7 segundos para dar paso al siguiente ciclo
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
            // Esperar a que finalice la animación CSS de fade-out (2 segundos)
            this.transitionTimeout = setTimeout(() => {
                bubble.classList.add("hidden");
            }, 2000);
        }
    }

    _hideBubbleDOMOnly() {
        const bubble = this.speechBubble;
        if (!bubble) return;
        clearTimeout(this.speechTimeout);
        clearTimeout(this.transitionTimeout);
        bubble.classList.remove("visible");
        bubble.classList.add("hidden");
    }

    onTargetFound(targetIndex) {
        this.currentTargetIndex = targetIndex;
        this._initTargetState(targetIndex);

        const state = this.targetStates[targetIndex];

        // Al enfocar el rostro, reanudar diálogos si estaban pausados
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