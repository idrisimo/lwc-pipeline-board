/**
 * Apex controller for the pipelineBoard Lightning Web Component.
 * Runs with sharing and enforces object/field security via USER_MODE.
 * All filter values are passed as bind variables (no concatenation of user input into SOQL).
 */
public with sharing class PipelineBoardController {
    public static final String OWNER_MINE = 'MINE';
    public static final String OWNER_ALL = 'ALL';
    private static final Integer MAX_ROWS = 2000;

    /**
     * Returns Opportunities for the board, honouring the supplied filters.
     * @param ownerFilter 'MINE' for the running user's records, anything else (e.g. 'ALL') for all visible records
     * @param closeFrom   inclusive lower bound for CloseDate (nullable)
     * @param closeTo     inclusive upper bound for CloseDate (nullable)
     * @param searchTerm  matches Opportunity Name or Account Name (nullable)
     */
    @AuraEnabled(cacheable=true)
    public static List<Opportunity> getOpportunities(
        String ownerFilter,
        Date closeFrom,
        Date closeTo,
        String searchTerm
    ) {
        return getOpportunities(ownerFilter, closeFrom, closeTo, searchTerm, true);
    }

    /**
     * Same as the AuraEnabled method, with an option to exclude closed stages.
     */
    public static List<Opportunity> getOpportunities(
        String ownerFilter,
        Date closeFrom,
        Date closeTo,
        String searchTerm,
        Boolean includeClosed
    ) {
        Map<String, Object> binds = new Map<String, Object>();
        List<String> conditions = new List<String>();

        if (String.isNotBlank(ownerFilter) && ownerFilter.equalsIgnoreCase(OWNER_MINE)) {
            conditions.add('OwnerId = :ownerId');
            binds.put('ownerId', UserInfo.getUserId());
        }
        if (closeFrom != null) {
            conditions.add('CloseDate >= :closeFrom');
            binds.put('closeFrom', closeFrom);
        }
        if (closeTo != null) {
            conditions.add('CloseDate <= :closeTo');
            binds.put('closeTo', closeTo);
        }
        if (String.isNotBlank(searchTerm)) {
            String escaped = searchTerm.trim()
                .replace('\\', '\\\\')
                .replace('%', '\\%')
                .replace('_', '\\_');
            conditions.add('(Name LIKE :likeTerm OR Account.Name LIKE :likeTerm)');
            binds.put('likeTerm', '%' + escaped + '%');
        }
        if (includeClosed == false) {
            conditions.add('IsClosed = false');
        }
        binds.put('maxRows', MAX_ROWS);

        String soql =
            'SELECT Id, Name, Amount, StageName, CloseDate, AccountId, Account.Name, OwnerId, Owner.Name, IsClosed ' +
            'FROM Opportunity';
        if (!conditions.isEmpty()) {
            soql += ' WHERE ' + String.join(conditions, ' AND ');
        }
        soql += ' ORDER BY CloseDate ASC, Amount DESC NULLS LAST LIMIT :maxRows';

        return Database.queryWithBinds(soql, binds, AccessLevel.USER_MODE);
    }
}
