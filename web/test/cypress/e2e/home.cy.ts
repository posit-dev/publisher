// Use `cy.dataCy` custom command for more robust tests
// See https://docs.cypress.io/guides/references/best-practices.html#Selecting-Elements

// This test will pass when run against a clean Quasar project
describe('Landing', () => {
  beforeEach(() => {
    cy.visit('http://127.0.0.1:9000/?token=abc123');
  });
  it('.should() - assert that <title> is correct', () => {
    cy.title().should('include', 'Posit Publishing Web UI');
  });
});

describe('Check Files', () => {
  beforeEach(() => {
    cy.visit('http://127.0.0.1:9000/?token=abc123');
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
  it('check deployment', () => {
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

// ** The following code is an example to show you how to write some tests for your home page **
//
// describe('Home page tests', () => {
//   beforeEach(() => {
//     cy.visit('/');
//   });
//   it('has pretty background', () => {
//     cy.dataCy('landing-wrapper')
//       .should('have.css', 'background')
//       .and('match', /(".+(\/img\/background).+\.png)/);
//   });
//   it('has pretty logo', () => {
//     cy.dataCy('landing-wrapper img')
//       .should('have.class', 'logo-main')
//       .and('have.attr', 'src')
//       .and('match', /^(data:image\/svg\+xml).+/);
//   });
//   it('has very important information', () => {
//     cy.dataCy('instruction-wrapper')
//       .should('contain', 'SETUP INSTRUCTIONS')
//       .and('contain', 'Configure Authentication')
//       .and('contain', 'Database Configuration and CRUD operations')
//       .and('contain', 'Continuous Integration & Continuous Deployment CI/CD');
//   });
// });

// Workaround for Cypress AE + TS + Vite
// See: https://github.com/quasarframework/quasar-testing/issues/262#issuecomment-1154127497
export {};
