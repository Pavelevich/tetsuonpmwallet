/**
 * TETSUO Wallet SDK - RPC Client
 */

import axios, { AxiosInstance } from 'axios';
import { Balance, Transaction, BlockchainInfo, TransactionResult, UTXO, RPCError } from './types';

export class TetsuoRPC {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(networkUrl: string) {
    this.baseURL = networkUrl;
    this.client = axios.create({
      baseURL: networkUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get blockchain info
   */
  async getBlockchainInfo(): Promise<BlockchainInfo> {
    try {
      const response = await this.client.get<any>('/api/blockchain/info');
      return {
        blockHeight: response.data.blockHeight || 0,
        difficulty: response.data.difficulty || 0,
        networkName: response.data.networkName || 'TETSUO',
        isConnected: true
      };
    } catch (error) {
      throw this.handleError('Failed to get blockchain info', error);
    }
  }

  /**
   * Get balance for an address
   */
  async getBalance(address: string): Promise<number> {
    try {
      const response = await this.client.get<any>(`/api/wallet/balance/${address}`);
      return response.data.balance || 0;
    } catch (error) {
      throw this.handleError(`Failed to get balance for ${address}`, error);
    }
  }

  /**
   * Get detailed balance info
   */
  async getDetailedBalance(address: string): Promise<Balance> {
    try {
      const response = await this.client.get<any>(`/api/wallet/balance/${address}`);
      return {
        confirmed: response.data.confirmed || 0,
        unconfirmed: response.data.unconfirmed || 0,
        total: response.data.balance || 0
      };
    } catch (error) {
      throw this.handleError(`Failed to get detailed balance`, error);
    }
  }

  /**
   * Get UTXOs for an address
   */
  async getUTXOs(address: string): Promise<UTXO[]> {
    try {
      const response = await this.client.get<any>(`/api/wallet/utxos/${address}`);
      return Array.isArray(response.data.utxos) ? response.data.utxos : [];
    } catch (error) {
      throw this.handleError(`Failed to get UTXOs for ${address}`, error);
    }
  }

  /**
   * Get transaction history for an address
   */
  async getTransactionHistory(address: string): Promise<Transaction[]> {
    try {
      const response = await this.client.get<any>(`/api/wallet/transactions/${address}`);

      if (!Array.isArray(response.data.transactions)) {
        return [];
      }

      return response.data.transactions.map((tx: any) => ({
        txid: tx.txid,
        amount: tx.amount || 0,
        type: tx.type === 'receive' ? 'receive' : 'send',
        confirmations: tx.confirmations || 0,
        timestamp: tx.timestamp || Date.now(),
        address: tx.address
      }));
    } catch (error) {
      // Return empty array if endpoint not available
      return [];
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txid: string): Promise<any> {
    try {
      const response = await this.client.get<any>(`/api/transaction/${txid}`);
      return response.data;
    } catch (error) {
      throw this.handleError(`Failed to get transaction ${txid}`, error);
    }
  }

  /**
   * Broadcast a signed transaction
   */
  async broadcastTransaction(transactionHex: string): Promise<string> {
    try {
      const response = await this.client.post<any>('/api/transaction/broadcast', {
        hex: transactionHex
      });

      if (!response.data.txid) {
        throw new Error('No transaction ID returned');
      }

      return response.data.txid;
    } catch (error) {
      throw this.handleError('Failed to broadcast transaction', error);
    }
  }

  /**
   * Estimate fee for transaction
   */
  async estimateFee(inputCount: number, outputCount: number): Promise<number> {
    try {
      const response = await this.client.get<any>('/api/fee/estimate', {
        params: { inputCount, outputCount }
      });

      return response.data.fee || 25000;
    } catch (error) {
      // Return default fee if endpoint fails
      return 25000;
    }
  }

  /**
   * Check if address is valid
   */
  async validateAddress(address: string): Promise<boolean> {
    try {
      const response = await this.client.get<any>(`/api/address/validate/${address}`);
      return response.data.valid || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get address details
   */
  async getAddressInfo(address: string): Promise<any> {
    try {
      const response = await this.client.get<any>(`/api/address/${address}`);
      return response.data;
    } catch (error) {
      throw this.handleError(`Failed to get address info`, error);
    }
  }

  /**
   * Health check
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.client.get<any>('/api/ping');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Private method to handle errors
   */
  private handleError(message: string, error: any): RPCError {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 0;
      const errorMsg = error.response?.data?.error || error.message;
      return new RPCError(`${message}: ${errorMsg}`, status);
    }
    return new RPCError(`${message}: ${(error as Error).message}`);
  }
}

/**
 * Create an RPC client instance
 */
export function createRPCClient(networkUrl: string = 'http://localhost:8080'): TetsuoRPC {
  return new TetsuoRPC(networkUrl);
}
