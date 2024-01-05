describe('Publish', () => {
  it('publish content and check app type', () => {
    cy.visit({
      url: '/',
      qs: { token: Cypress.env('token') }
    });

    // Add a New Deployment button
    cy.get('div[data-automation="add-new-deployment"]')
      .click();

    // Continue to Deploy
    // ensure accounts are loaded to stall before clicking
    cy.get('label[data-automation="account"]')
      .should('exist');
    cy.get('button[data-automation="continue-deployment"]')
      .click();

    // Deploy
    cy.get('button[data-automation="deploy"]')
      .click();

    // Wait for Deployment Success message
    cy.get('div[data-automation="deploy-message"]', { timeout: 30000 })
      .contains("Deploy was successful!");

    // Get the link from the deployment logs
    cy.get('a[href="#/progress')
      .click();
    cy.get('div[class="space-between-sm"]')
      .find('p').last().invoke('text').then((guid) => {
        Cypress.env('DEPLOYED_APP_URL', '/__api__/v1/content/' + guid);
        cy.log("MY GUID " + Cypress.env('DEPLOYED_APP_URL'));
        cy.log("MY URL " + Cypress.env('CYPRESS_CONNECT_ADDRESS') + Cypress.env('DEPLOYED_APP_URL'))

        // Use API to check the content on Connect
        cy.request({
          method: 'GET',
          url: Cypress.env('CYPRESS_CONNECT_ADDRESS') + Cypress.env('DEPLOYED_APP_URL'),
          'auth': {
            'bearer': Cypress.env('CONNECT_API_KEY')
        },
      }).then((response) => {
        expect(response.status).to.equal(200);
        // app mode should be correct
        expect(response.body).to.have.property('app_mode', 'python-fastapi')
      });
    });
  });
});
