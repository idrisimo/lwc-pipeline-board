@IsTest
private class PipelineBoardControllerTest {
    @TestSetup
    static void setup() {
        Account acme = new Account(Name = 'Acme Corp');
        Account globex = new Account(Name = 'Globex');
        insert new List<Account>{ acme, globex };

        Date today = Date.today();
        insert new List<Opportunity>{
            new Opportunity(
                Name = 'Acme Renewal',
                AccountId = acme.Id,
                StageName = 'Prospecting',
                CloseDate = today.addDays(10),
                Amount = 1000
            ),
            new Opportunity(
                Name = 'Acme Expansion',
                AccountId = acme.Id,
                StageName = 'Qualification',
                CloseDate = today.addDays(40),
                Amount = 5000
            ),
            new Opportunity(
                Name = 'Globex Platform',
                AccountId = globex.Id,
                StageName = 'Negotiation/Review',
                CloseDate = today.addDays(70),
                Amount = 20000
            ),
            new Opportunity(
                Name = 'Globex 100% Deal_X',
                AccountId = globex.Id,
                StageName = 'Closed Won',
                CloseDate = today.addDays(-5),
                Amount = 7500
            )
        };
    }

    @IsTest
    static void returnsAllOpportunitiesWithNoFilters() {
        Test.startTest();
        List<Opportunity> results = PipelineBoardController.getOpportunities(
            'ALL',
            null,
            null,
            null
        );
        Test.stopTest();

        Assert.areEqual(4, results.size(), 'All opportunities should be returned');
        Assert.areEqual(
            'Globex 100% Deal_X',
            results[0].Name,
            'Results should be ordered by CloseDate ascending'
        );
    }

    @IsTest
    static void ownerFilterMineReturnsOnlyRunningUsersRecords() {
        User other = createStandardUser('other');
        System.runAs(other) {
            insert new Opportunity(
                Name = 'Other Owner Opp',
                StageName = 'Prospecting',
                CloseDate = Date.today().addDays(5),
                Amount = 10
            );
        }

        Test.startTest();
        List<Opportunity> mine = PipelineBoardController.getOpportunities('MINE', null, null, null);
        List<Opportunity> allVisible = PipelineBoardController.getOpportunities(
            'ALL',
            null,
            null,
            null
        );
        Test.stopTest();

        Assert.areEqual(4, mine.size(), 'Only records owned by the running user are returned');
        for (Opportunity opp : mine) {
            Assert.areEqual(UserInfo.getUserId(), opp.OwnerId, 'Owner should be the running user');
        }
        Assert.areEqual(5, allVisible.size(), 'ALL includes records owned by other users');
    }

    @IsTest
    static void closeDateRangeFiltersResults() {
        Date today = Date.today();

        Test.startTest();
        List<Opportunity> fromOnly = PipelineBoardController.getOpportunities(
            'ALL',
            today.addDays(30),
            null,
            null
        );
        List<Opportunity> toOnly = PipelineBoardController.getOpportunities(
            'ALL',
            null,
            today,
            null
        );
        List<Opportunity> range = PipelineBoardController.getOpportunities(
            'ALL',
            today,
            today.addDays(45),
            null
        );
        Test.stopTest();

        Assert.areEqual(2, fromOnly.size(), 'Two opportunities close 30+ days out');
        Assert.areEqual(1, toOnly.size(), 'One opportunity closed before today');
        Assert.areEqual(2, range.size(), 'Two opportunities close within the next 45 days');
    }

    @IsTest
    static void searchMatchesOpportunityAndAccountName() {
        Test.startTest();
        List<Opportunity> byOppName = PipelineBoardController.getOpportunities(
            'ALL',
            null,
            null,
            'Platform'
        );
        List<Opportunity> byAccountName = PipelineBoardController.getOpportunities(
            'ALL',
            null,
            null,
            'acme'
        );
        List<Opportunity> noMatch = PipelineBoardController.getOpportunities(
            'ALL',
            null,
            null,
            'zzz-none'
        );
        Test.stopTest();

        Assert.areEqual(1, byOppName.size(), 'Search should match Opportunity Name');
        Assert.areEqual(2, byAccountName.size(), 'Search should match Account Name');
        Assert.isTrue(noMatch.isEmpty(), 'Unmatched term should return nothing');
    }

    @IsTest
    static void searchTreatsWildcardsAndQuotesAsLiterals() {
        String quoteTerm = '\' OR Name LIKE \'';

        Test.startTest();
        List<Opportunity> percent = PipelineBoardController.getOpportunities(
            'ALL',
            null,
            null,
            '100%'
        );
        List<Opportunity> underscore = PipelineBoardController.getOpportunities(
            'ALL',
            null,
            null,
            'Deal_X'
        );
        List<Opportunity> wildcardOnly = PipelineBoardController.getOpportunities(
            'ALL',
            null,
            null,
            '%_%'
        );
        List<Opportunity> injection = PipelineBoardController.getOpportunities(
            'ALL',
            null,
            null,
            quoteTerm
        );
        Test.stopTest();

        Assert.areEqual(1, percent.size(), 'Percent sign should be matched literally');
        Assert.areEqual(1, underscore.size(), 'Underscore should be matched literally');
        Assert.isTrue(wildcardOnly.isEmpty(), 'Wildcard characters must not match everything');
        Assert.isTrue(injection.isEmpty(), 'Quotes in the search term must not alter the query');
    }

    @IsTest
    static void canExcludeClosedStages() {
        Test.startTest();
        List<Opportunity> openOnly = PipelineBoardController.getOpportunities(
            'ALL',
            null,
            null,
            null,
            false
        );
        List<Opportunity> withClosed = PipelineBoardController.getOpportunities(
            'ALL',
            null,
            null,
            null,
            true
        );
        Test.stopTest();

        Assert.areEqual(3, openOnly.size(), 'Closed Won should be excluded');
        Assert.areEqual(4, withClosed.size(), 'Closed stages are included when requested');
    }

    @IsTest
    static void combinedFiltersAreAnded() {
        Date today = Date.today();

        Test.startTest();
        List<Opportunity> results = PipelineBoardController.getOpportunities(
            'MINE',
            today,
            today.addDays(100),
            'Globex'
        );
        Test.stopTest();

        Assert.areEqual(1, results.size(), 'Only the open Globex opportunity falls in range');
        Assert.areEqual('Globex Platform', results[0].Name, 'Expected Globex Platform');
    }

    private static User createStandardUser(String alias) {
        Profile p = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        String uniq = alias + String.valueOf(Math.abs(Crypto.getRandomInteger()));
        User u = new User(
            Alias = alias.left(8),
            Email = uniq + '@example.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Tester',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = p.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = uniq + '@pipelineboard.test'
        );
        insert u;
        return u;
    }
}
