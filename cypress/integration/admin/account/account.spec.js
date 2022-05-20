import uniqid from "uniqid";

context("Account Module", () => {
    beforeEach(() => cy.login());

    it("should be able to update account details and immediately see changes in the top-right user menu", () => {
        const [firstName, lastName] = [uniqid(), uniqid()];

        cy.visit("/account");
        cy.findByLabelText("Email");
        cy.should("value", Cypress.env("DEFAULT_ADMIN_USER_USERNAME"));
        cy.findByLabelText("Password");
        cy.should("value", "");
        cy.findByLabelText("First Name").clear().type(firstName);
        cy.findByLabelText("Last Name").clear().type(lastName);
        cy.findByText("Update account").click();
        cy.findByText("Account saved successfully!");
        cy.should("exist");

        // Make sure the changes were propagated in the top-right user menu,
        cy.findByTestId("logged-in-user-menu-avatar").click();
        cy.findByTestId("logged-in-user-menu-list").within(() => {
            cy.findByText(Cypress.env("DEFAULT_ADMIN_USER_USERNAME"));
            cy.should("exist");
            cy.findByText(`${firstName} ${lastName}`);
            cy.should("exist");
        });
    });

    it("should be able to change avatar", () => {
        cy.visit("/account");
        cy.get('div[data-role="select-image"]').click();

        cy.findByTestId("fm-list-wrapper").dropFile("sample.jpeg", "image/jpeg");
        cy.findByText("File upload complete.").should("exist");
        cy.get('div[data-testid="fm-list-wrapper-file"]:first-child').click();

        cy.get('div.mdc-layout-grid div > img').should('exist');
       
        cy.get('span').contains('Update account').click();
        cy.contains('Account saved successfully').should('be.visible');

        // Refresh page to assert the avatar persists.
        cy.reload();
        cy.get('div.mdc-layout-grid div > img').should('exist');

        // Delete the newly avatar image.
        cy.findByTestId('remove-image').click({force: true})
        cy.get('div.mdc-layout-grid div > img').should('not.exist');
        cy.findByText("Update account").click();
        cy.findByText("Account saved successfully!");
    });
});
