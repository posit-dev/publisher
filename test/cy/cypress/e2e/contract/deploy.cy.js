describe('Publish', () => {
  it('publish content and check app type', () => {
    cy.visit({
      url: '/',
      qs: { token: Cypress.env('token') }
    });
    // Add a New Deployment button
    cy.get('a[href="#/add-new-deployment"')
      .click();
    // Continue to Deploy
    cy.get('div[class="flex row reverse"]')
      .find('span[class="q-btn__content text-center col items-center q-anchor--skip justify-center row"]')
      .contains("Continue to Deploy")
      .click();
    // Deploy
    cy.get('span[class="q-btn__content text-center col items-center q-anchor--skip justify-center row"]')
      .contains("Deploy")
      .click();
    // Wait for Deployment Success message
    cy.get('div[class="summary row text-left items-center text-black"]', { timeout: 30000 })
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
        // API Call should succeed
        expect(response.status).to.equal(200);
        // app mode should be correct
        expect(response.body).to.have.property('app_mode', 'python-fastapi')
      });
        });

});
});
