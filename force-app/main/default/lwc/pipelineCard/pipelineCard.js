import { LightningElement, api } from 'lwc';
import CURRENCY from '@salesforce/i18n/currency';

export default class PipelineCard extends LightningElement {
    @api record;

    currencyCode = CURRENCY;

    get recordId() {
        return this.record?.Id;
    }

    get name() {
        return this.record?.Name;
    }

    get amount() {
        return this.record?.Amount;
    }

    get closeDate() {
        return this.record?.CloseDate;
    }

    get accountName() {
        return this.record?.Account?.Name || 'No account';
    }

    get ownerName() {
        return this.record?.Owner?.Name || '';
    }

    get hasAmount() {
        return this.amount !== undefined && this.amount !== null;
    }

    get closeDateClass() {
        const base = 'slds-text-body_small close-date';
        if (this.record && !this.record.IsClosed && this.record.CloseDate) {
            const today = new Date().toISOString().slice(0, 10);
            if (this.record.CloseDate < today) {
                return `${base} slds-text-color_error`;
            }
        }
        return base;
    }

    handleClick() {
        this.dispatchEvent(new CustomEvent('select', { detail: { recordId: this.recordId } }));
    }

    handleKeyDown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.handleClick();
        }
    }

    handleDragStart(event) {
        if (event.dataTransfer) {
            event.dataTransfer.setData('text/plain', this.recordId);
            event.dataTransfer.effectAllowed = 'move';
        }
        this.template.querySelector('.card').classList.add('card_dragging');
    }

    handleDragEnd() {
        this.template.querySelector('.card').classList.remove('card_dragging');
    }
}
