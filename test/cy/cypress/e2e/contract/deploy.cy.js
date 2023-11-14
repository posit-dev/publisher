describe('Publish', () => {
  it('hit the publish button', () => {
    cy.visit({
      url: '/',
      qs: { token: Cypress.env('token') }
    });
    cy.get('.block').contains('Publish')
      .click();
  });
});

describe('Check Connect Deployment', () => {
  it('check deployment', { baseUrl: null }, () => {
    cy.visit(Cypress.env('CYPRESS_CONNECT_ADDRESS'));
    cy.get('#username').type('admin');
    cy.get('#password').type('password');
    cy.get('button[data-automation="login-panel-submit"]')
      .click();
    cy.get('#rs_radio_cop-visibility_editor')
      .click();
    cy.get('h1[data-automation="content-list-title"]')
      .contains('Your Content');
    cy.get('td[data-automation="content-row-icon-title-cell"]')
      .contains('Untitled')
      .click();
  });
});
