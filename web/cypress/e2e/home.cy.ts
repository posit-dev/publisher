describe('Landing', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('.should() - assert that <title> is correct', () => {
    cy.title().should('include', 'Posit Publishing Web UI');
  });
});

describe('Check Files', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('files should be listed', () => {
    cy.contains('.q-item__label', 'Files').should('be.visible')
      .click();
    cy.get('.q-tree__node-header-content').contains('fastapi-simple');
  });
});
