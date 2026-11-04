import { LightningElement, api } from 'lwc';
import CURRENCY from '@salesforce/i18n/currency';

const DEFAULT_MAX_CARDS = 50;

export default class PipelineColumn extends LightningElement {
    @api stage;
    @api maxCards = DEFAULT_MAX_CARDS;

    currencyCode = CURRENCY;
    isDragOver = false;
    _cards = [];

    @api
    get cards() {
        return this._cards;
    }
    set cards(value) {
        this._cards = Array.isArray(value) ? value : [];
    }

    get columnClass() {
        return `column slds-is-relative${this.isDragOver ? ' column_over' : ''}`;
    }

    get totalCount() {
        return this._cards.length;
    }

    get totalAmount() {
        return this._cards.reduce((sum, c) => sum + (c.Amount || 0), 0);
    }

    get visibleCards() {
        return this._cards.slice(0, this.maxCards);
    }

    get hiddenCount() {
        return Math.max(this._cards.length - this.maxCards, 0);
    }

    get hasHiddenCards() {
        return this.hiddenCount > 0;
    }

    get isEmpty() {
        return this._cards.length === 0;
    }

    handleDragOver(event) {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
        this.isDragOver = true;
    }

    handleDragLeave() {
        this.isDragOver = false;
    }

    handleDrop(event) {
        event.preventDefault();
        this.isDragOver = false;
        const recordId = event.dataTransfer?.getData('text/plain');
        if (recordId) {
            this.dispatchEvent(
                new CustomEvent('cardmove', { detail: { recordId, stage: this.stage } })
            );
        }
    }

    handleCardSelect(event) {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('cardselect', { detail: event.detail }));
    }
}
