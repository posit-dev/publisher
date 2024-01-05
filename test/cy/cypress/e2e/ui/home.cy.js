describe('Landing', () => {
  beforeEach(() => {
    cy.visit({
      url: '/',
    });
  });
  it('.should() - assert that <title> is correct', () => {
    cy.title().should('include', 'Posit Publisher');
  });
  
  it('dark mode works', () => {
    // expand dark mode menu
    cy.expandDarkMenu();
    cy.get('body').should('have.css', 'background-color', 'rgb(250, 250, 250)');

    // set dark mode on
    cy.get('div[data-automation="dark-on"]')
      .click();
    cy.get('body').should('have.css', 'background-color', 'rgb(18, 18, 18)');

    cy.expandDarkMenu();
    // set dark mode off
    cy.get('div[data-automation="dark-off"]')
      .click();
    cy.get('body').should('have.css', 'background-color', 'rgb(250, 250, 250)');

    cy.expandDarkMenu();
    // set dark mode auto
    cy.get('div[data-automation="dark-auto"]')
      .click();
    cy.get('body').should('have.css', 'background-color', 'rgb(250, 250, 250)');
  });

it('configuration file is displayed', () => {
  cy.get('div[data-automation="config-card"]')
    .find('h3[class="card-title truncate"]')
    .contains("default");
  
  cy.get('div[data-automation="config-card"]')
    .find('p')
    .contains(".posit/publish/default.toml");
  });

it('files are displayed', () => {
  cy.get('div[data-automation="file-tree"]')
    .should('contain', 'fastapi-simple')
    .and('contain', 'requirements.txt')
    .and('contain', 'simple.py');
  });
});