#!/usr/bin/env -S deno run -A

/**
 * @title Deploy PaymentSubscription Contract
 * @dev Deploy the PaymentSubscription contract for subscription payments
 *
 * Usage:
 *   deno run -A deploy/2-payment-subscription.ts --network local
 */

import type { Deployer } from "@dreamer/foundry";
import { logger } from "@dreamer/foundry";

/**
 * Deploy function
 * @param deployer Deployer object
 */
export async function deploy(deployer: Deployer) {
  logger.info("Starting PaymentSubscription contract deployment\n");

  // PaymentSubscription has no constructor arguments
  // The deployer becomes the owner automatically
  const args: string[] = [];

  // Deploy the contract
  const paymentSubscription = await deployer.deploy("PaymentSubscription", args);

  logger.info(`✅ PaymentSubscription deployed at: ${paymentSubscription.address}`);

 
}
