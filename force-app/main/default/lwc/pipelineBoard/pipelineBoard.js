import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import { updateRecord } from 'lightning/uiRecordApi';
import { refreshApex } from '@salesforce/apex';
import OPPORTUNITY_OBJECT from '@salesforce/schema/Opportunity';
import STAGE_FIELD from '@salesforce/schema/Opportunity.StageName';
import ID_FIELD from '@salesforce/schema/Opportunity.Id';
import getOpportunities from '@salesforce/apex/PipelineBoardController.getOpportunities';

const SEARCH_DEBOUNCE_MS = 300;

export default class PipelineBoard extends NavigationMixin(LightningElement) {
    @api maxCardsPerColumn = 50;

    ownerFilter = 'MINE';
    closeFrom = null;
    closeTo = null;
    searchTerm = '';
    ownerOptions = [
        { label: 'My opportunities', value: 'MINE' },
        { label: 'All opportunities', value: 'ALL' }
    ];

    stages = [];
    records = [];
    loadError;
    _wiredOpportunities;
    _searchTimer;

    @wire(getObjectInfo, { objectApiName: OPPORTUNITY_OBJECT })
    objectInfo;

    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: STAGE_FIELD
    })
    wiredStages({ data, error }) {
        if (data) {
            this.stages = data.values.map((v) => v.value);
        } else if (error) {
            this.showError('Could not load pipeline stages', error);
        }
    }

    @wire(getOpportunities, {
        ownerFilter: '$ownerFilter',
        closeFrom: '$closeFrom',
        closeTo: '$closeTo',
        searchTerm: '$searchTerm'
    })
    wiredOpportunities(result) {
        this._wiredOpportunities = result;
        const { data, error } = result;
        if (data) {
            this.records = data.map((r) => ({ ...r }));
            this.loadError = undefined;
        } else if (error) {
            this.records = [];
            this.loadError = this.reduceError(error);
        }
    }

    get columns() {
        return this.stages.map((stage) => ({
            stage,
            cards: this.records.filter((r) => r.StageName === stage)
        }));
    }

    get hasColumns() {
        return this.stages.length > 0;
    }

    get maxCards() {
        const n = parseInt(this.maxCardsPerColumn, 10);
        return n > 0 ? n : 50;
    }

    get isLoading() {
        return !this.hasColumns && !this.loadError;
    }

    disconnectedCallback() {
        clearTimeout(this._searchTimer);
    }

    handleOwnerChange(event) {
        this.ownerFilter = event.detail.value;
    }

    handleFromChange(event) {
        this.closeFrom = event.target.value || null;
    }

    handleToChange(event) {
        this.closeTo = event.target.value || null;
    }

    handleSearchChange(event) {
        const value = event.target.value;
        clearTimeout(this._searchTimer);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._searchTimer = setTimeout(() => {
            this.searchTerm = value;
        }, SEARCH_DEBOUNCE_MS);
    }

    handleCardSelect(event) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: event.detail.recordId,
                objectApiName: 'Opportunity',
                actionName: 'view'
            }
        });
    }

    async handleCardMove(event) {
        const { recordId, stage } = event.detail;
        const original = this.records.find((r) => r.Id === recordId);
        if (!original || original.StageName === stage) {
            return;
        }
        const previousStage = original.StageName;

        // Optimistic UI update
        this.records = this.records.map((r) => {
            return r.Id === recordId ? { ...r, StageName: stage } : r;
        });

        try {
            await updateRecord({
                fields: { [ID_FIELD.fieldApiName]: recordId, [STAGE_FIELD.fieldApiName]: stage }
            });
            await refreshApex(this._wiredOpportunities);
        } catch (error) {
            // Roll back
            this.records = this.records.map((r) => {
                return r.Id === recordId ? { ...r, StageName: previousStage } : r;
            });
            this.showError('Could not move opportunity', error);
        }
    }

    showError(title, error) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message: this.reduceError(error),
                variant: 'error'
            })
        );
    }

    reduceError(error) {
        if (!error) {
            return 'Unknown error';
        }
        if (Array.isArray(error.body)) {
            return error.body.map((e) => e.message).join(', ');
        }
        return error.body?.message || error.message || 'Unknown error';
    }
}
