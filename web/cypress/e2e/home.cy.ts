describe('Landing', () => {
  beforeEach(() => {
    cy.visit({
      url: '/',
      qs: { token: Cypress.env('publishing-token') }
    });
  });
  it('.should() - assert that <title> is correct', () => {
    cy.title().should('include', 'Posit Publishing Web UI');
  });
});

describe('Check Files', () => {
  beforeEach(() => {
    cy.visit({
      url: '/',
      qs: { token: Cypress.env('publishing-token') }
    });
  });
  it('files should be listed', () => {
    cy.contains('.q-item__label', 'Files').should('be.visible')
      .click();
    cy.get('.q-tree__node-header-content').contains('fastapi-simple');
  });
});
describe('Publish', () => {
  it('hit the publish button', () => {
    cy.visit('http://127.0.0.1:9000/?token=abc123');
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
