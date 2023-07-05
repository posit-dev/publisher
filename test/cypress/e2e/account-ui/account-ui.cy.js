describe('Account UI Test', () => {
  
  it('Account UI loads', () => {
    cy.log("LOGS!!!")
    cy.log(Cypress.env('CYPRESS_BASE_URL'))
    cy.visit(Cypress.env('CYPRESS_BASE_URL'))
  });
});
