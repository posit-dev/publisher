describe('Landing', () => {
  beforeEach(() => {
    cy.visit({
      url: '/',
    });
  });
  it('.should() - assert that <title> is correct', () => {
    cy.title().should('include', 'Posit Publishing Assistant');
  });
});
