import { Page, Locator } from '@playwright/test';

export class FlightSearchPage {
  readonly page: Page;
  readonly oneWayRadio: Locator;
  readonly fromInput: Locator;
  readonly fromAirportOption: Locator;
  readonly toInput: Locator;
  readonly toAirportOption: Locator;
  readonly departureDateInput: Locator;
  readonly departNextMonthButton: Locator;
  readonly departureDateOption: Locator;
  readonly searchButton: Locator;  

  constructor(page: Page) {
    this.page = page;
    this.oneWayRadio = page.getByText('One way');
    this.fromInput = page.getByRole('textbox', { name: 'From' });
    this.fromAirportOption = page.getByTestId('airport-option-DFW');
    this.toInput = page.getByRole('textbox', { name: 'To' });
    this.toAirportOption = page.getByTestId('airport-option-JFK');
    this.departureDateInput = page.getByRole('textbox', { name: 'Depart' });
    this.departNextMonthButton = page.getByRole('button', { name: 'Next month' });
    this.departureDateOption = page.getByRole('button', { name: '1' }).first();
    this.searchButton = page.getByRole('button', { name: 'Search flights' });
  }

  async goToFlightSearchPage(): Promise<void> {
    await this.page.goto('/');
  }

  async searchOneWayFlight(from: string, to: string, departureDate: string): Promise<void> {
    await this.oneWayRadio.click();
    await this.fromInput.fill(from);
    await this.fromAirportOption.click();
    await this.toInput.fill(to);
    await this.toAirportOption.click();
    await this.departureDateInput.click();
    await this.departNextMonthButton.click();
    await this.departureDateOption.click();
    await this.searchButton.click();
    

  }
}