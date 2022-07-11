import uniqid from "uniqid";

context("Categories Module", () => {
    beforeEach(() => cy.login());

    it("should be able to create, edit, and immediately delete a category", () => {
        const id = uniqid();
        cy.visit("/page-builder/categories");
        cy.findByTestId("data-list-new-record-button").click();

        cy.findByLabelText("Name").type(`Cool Category ${id}`);
        cy.findByText("Save category").click();
        cy.findAllByText("Value is required.").should("exist").should("have.length", 2);
        cy.findByLabelText("URL").type(`Some URL`);
        cy.findByText("Save category").click();
        cy.findByText("Value is required.").should("exist");
        cy.findByLabelText("Slug").type(`cool-category-${id}`);
        cy.findByText("Save category").click();
        cy.findByText("Value is required.").should("not.exist");
        cy.findByText("Category URL must begin and end with a forward slash (`/`)").should("exist");
        cy.findByLabelText("URL").clear().type(`/some-url-for-category-${id}/`);
        cy.findByText("Save category").click();
        cy.findByText("Category URL must begin and end with a forward slash (`/`)").should(
            "not.exist"
        );
        cy.findByText("Save category").click();

        cy.wait(500);
        cy.findByText("Category saved successfully.").should("exist");

        cy.wait(500);
        cy.findByTestId("default-data-list").within(() => {
            cy.findByText(`Cool Category ${id}`).should("exist");
            cy.findByText(`/some-url-for-category-${id}/`).should("exist");

            cy.findByText(`Cool Category ${id}`)
                .parent("div")
                .within(() => {
                    cy.get("button").click({ force: true });
                });
        });

        cy.get('[role="alertdialog"] :visible').within(() => {
            cy.contains("Are you sure you want to continue?")
                .next()
                .within(() => cy.findByText("Confirm").click());
        });

        cy.findByText(`Category "cool-category-${id}" deleted.`).should("exist");
        cy.findByTestId("default-data-list").within(() => {
            cy.findByText(`Cool Category ${id}`).should("not.exist");
        });
    });

    it("should not be able to create category if slug already exists", () => {
        // Create category.
        const id = uniqid();
        const slugValue = `cool-category-${id}`;

        cy.visit("/page-builder/categories");
        cy.findByTestId("data-list-new-record-button").click();

        cy.findByLabelText("Name").type(`Cool Category ${id}`);
        cy.findByText("Save category").click();
        cy.findAllByText("Value is required.").should("exist").should("have.length", 2);
        cy.findByLabelText("URL").type(`Some URL`);
        cy.findByText("Save category").click();
        cy.findByText("Value is required.").should("exist");
        cy.findByLabelText("Slug").type(slugValue);
        cy.findByText("Save category").click();
        cy.findByText("Value is required.").should("not.exist");
        cy.findByText("Category URL must begin and end with a forward slash (`/`)").should("exist");
        cy.findByLabelText("URL").clear().type(`/some-url-for-category-${id}/`);
        cy.findByText("Save category").click();
        cy.findByText("Category URL must begin and end with a forward slash (`/`)").should(
            "not.exist"
        );
        cy.findByText("Save category").click();
        cy.wait(500);
        cy.findByText("Category saved successfully.").should("exist");

        // Try to create a new category using the same slug.
        cy.visit("/page-builder/categories");
        cy.findByTestId("data-list-new-record-button").click();
        cy.findByLabelText("Name").type(`Cool Category ${id} duplicate`);
        cy.findByText("Save category").click();
        cy.findAllByText("Value is required.").should("exist").should("have.length", 2);
        cy.findByLabelText("URL").type(`Some URL`);
        cy.findByText("Save category").click();
        cy.findByText("Value is required.").should("exist");
        cy.findByLabelText("Slug").type(slugValue);
        cy.findByText("Save category").click();
        cy.findByText("Value is required.").should("not.exist");
        cy.findByText("Category URL must begin and end with a forward slash (`/`)").should("exist");
        cy.findByLabelText("URL").clear().type(`/some-url-for-category-${id}/`);
        cy.findByText("Save category").click();
        cy.findByText("Category URL must begin and end with a forward slash (`/`)").should(
            "not.exist"
        );
        cy.findByText("Save category").click();
        cy.wait(500);
        cy.findByText(`Category with slug "${slugValue}" already exists.`).should("exist");
    });

    it("should be able to access new category form via link", () => {
        cy.visit("/page-builder/pages");
        cy.get('div.action__container button[data-testid="new-record-button"]').click();
        cy.findByText("+ Create new category").click();
        cy.findByTestId("data-list-new-record-button").should("be.visible");
    });

    it("should not be able to delete categories if they contain pages", () => {
        // Create category.
        const id = uniqid();
        cy.visit("/page-builder/categories");
        cy.findByTestId("data-list-new-record-button").click();

        cy.findByLabelText("Name").type(`Cool Category ${id}`);
        cy.findByText("Save category").click();
        cy.findAllByText("Value is required.").should("exist").should("have.length", 2);
        cy.findByLabelText("URL").type(`Some URL`);
        cy.findByText("Save category").click();
        cy.findByText("Value is required.").should("exist");
        cy.findByLabelText("Slug").type(`cool-category-${id}`);
        cy.findByText("Save category").click();
        cy.findByText("Value is required.").should("not.exist");
        cy.findByText("Category URL must begin and end with a forward slash (`/`)").should("exist");
        cy.findByLabelText("URL").clear().type(`/some-url-for-category-${id}/`);
        cy.findByText("Save category").click();
        cy.findByText("Category URL must begin and end with a forward slash (`/`)").should(
            "not.exist"
        );
        cy.findByText("Save category").click();

        cy.wait(500);
        cy.findByText("Category saved successfully.").should("exist");

        // Use category to create a new page.
        cy.visit("/page-builder/pages");
        cy.get('div.action__container button[data-testid="new-record-button"]').click();
        cy.findByText(`Cool Category ${id}`).click();
        cy.findByText(`Publish`).click();
        cy.get(
            '[data-testid="pb-editor-publish-confirmation-dialog"] [data-testid="confirmationdialog-confirm-action"]'
        ).click();
        cy.wait(500);
        cy.findByText("Your page was published successfully!").should("exist");

        // Delete category.
        cy.visit("/page-builder/categories");
        cy.get('[data-testid="default-data-list"] > div:nth-child(1) button').click({
            force: true
        });
        cy.findByText("Confirm").click();

        // de adaugat assert dupa bug fix
    });

    it("should be able add tags in page settings", () => {
        // Create the first page.
        cy.visit("/page-builder/pages");
        cy.get('div.action__container button[data-testid="new-record-button"]').click();
        cy.get('[data-testid="pb-new-page-category-modal"] div.mdc-list-item:last-child').click();
        // cy.get("header > div > section:last-child > button.mdc-icon-button").click(); // Settings button
        cy.findByTestId('page-settings-btn').click();
        cy.get('div[aria-haspopup="listbox"] input').type("super-page");
        cy.get('li[role="option"]').contains("super-page").click();

        cy.get('div[aria-haspopup="listbox"] input').type("super-page-a");
        cy.get('li[role="option"]').contains("super-page-a").click();
        cy.findByText("Save Settings").click();

        // Create the second page.
        cy.visit("/page-builder/pages");
        cy.get('div.action__container button[data-testid="new-record-button"]').click();
        cy.get('[data-testid="pb-new-page-category-modal"] div.mdc-list-item:last-child').click();
        // cy.get("header > div > section:last-child > button.mdc-icon-button").click(); // Settings button
        cy.findByTestId('page-settings-btn').click();
        cy.get('div[aria-haspopup="listbox"] input').type("super-");
        cy.wait(2000);
        cy.get('li[role="option"] span').contains("super-page").should("be.visible");
        cy.get('li[role="option"] span').contains("super-page-a").should("be.visible");
        cy.get('li[role="option"] span').contains("super-page").click();

        cy.get('div[aria-haspopup="listbox"] input').type("super-");
        cy.wait(2000);
        cy.get('li[role="option"] span').should("not.have.text", "super-page");
        cy.get('li[role="option"]').contains("super-page-a").should("be.visible");

        cy.get('div[aria-haspopup="listbox"] input').type("page-b");
        cy.get('li[role="option"]').contains("super-page-b").click();
        cy.findByText("Save Settings").click();
        cy.findByText("Settings saved!").should("be.visible");
        // cy.get("header > div > section:last-child > button.mdc-icon-button").click();
        cy.findByTestId('page-settings-btn').click();
        cy.contains("super-page").should("be.visible");
        cy.contains("super-page-b").should("be.visible");
    });

    it("should be able test slug input", () => {
        
        // Create the first page.
        cy.visit("/page-builder/pages");
        cy.get('div.action__container button[data-testid="new-record-button"]').click();
        cy.get('[data-testid="pb-new-page-category-modal"] div.mdc-list-item:last-child').click();
        cy.findByTestId('page-settings-btn').click();
        cy.get("#textfield-ldui2ipiyy").type('/about-us')

        cy.findByText("Save Settings").click();
    });

    it("should be able to close main menu page builder editor on Esc key", () => {
        cy.visit("/page-builder/pages");
        cy.get('div.action__container button[data-testid="new-record-button"]').click();
        cy.get('[data-testid="pb-new-page-category-modal"] div.mdc-list-item:last-child').click();
        cy.findByTestId('pb-content-add-block-button').click();
        cy.findByTestId('pb-editor-page-blocks-list-item-grid-block').trigger('mouseover');
        cy.findByText('Click to Add').click({force: true});

        cy.findByTestId('add-element').click();
        cy.wait(1000);
        cy.findByText('Saved').should('exist');
        cy.findByTestId('add-element').type('{esc}');
        cy.findByText('Saved').should('not.be.visible');
    });

    it.only("should ensure cloning page element works correctly", () => {
        cy.visit("/page-builder/pages");
        cy.get('div.action__container button[data-testid="new-record-button"]').click();
        cy.get('[data-testid="pb-new-page-category-modal"] div.mdc-list-item:last-child').click();
        cy.findByTestId('pb-content-add-block-button').click();
        cy.findByTestId('pb-editor-page-blocks-list-item-grid-block').trigger('mouseover');
        cy.findByText('Click to Add').click({force: true});

        cy.findByTestId('add-element').click();
        cy.wait(5000);

        cy.get('[data-testid="grid-section"] div.background').as('dropBtnSection');

        cy.get('[data-testid="pb-editor-add-element-button-paragraph"]').drag('@dropBtnSection', {force: true}).then((success) => {
            assert.isTrue(success)
          })

        // cy.get('.e1ewqqw50').as('dropBtnSection');

        // cy.get('[data-testid="pb-editor-add-element-button-paragraph"]').drag('@dropBtnSection', {force: true}).then((success) => {
        //     assert.isTrue(success)
        //   })

          cy.wait(2000);
        cy.findByTestId('add-element').click();
    });
});
