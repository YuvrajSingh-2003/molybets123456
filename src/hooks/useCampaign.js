import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONFIG } from '../config';
import CampaignAbi from '../abis/Campaign.json';
import MockUSDCAbi from '../abis/MockUSDC.json';

export const useCampaign = (address, signer, account) => {
  const [data, setData] = useState({
    question: "",
    targetPrice: 0n,
    lockTime: 0n,
    yesPool: 0n,
    noPool: 0n,
    resolved: false,
    winningSide: 0,
    state: "OPEN",
    yesPct: 50,
    noPct: 50,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError, setErrorState] = useState(null);
  const [error, setError] = useState(null);

  const fetchCampaignData = useCallback(async () => {
    if (!address || !signer || address === "FILL_ME") return;

    try {
      const contract = new ethers.Contract(address, CampaignAbi, signer);
      
      const [
        question, 
        targetPrice, 
        lockTime, 
        yesPool, 
        noPool, 
        resolved, 
        winningSide, 
        state, 
        odds
      ] = await Promise.all([
        contract.question(),
        contract.targetPrice(),
        contract.lockTime(),
        contract.yesPool(),
        contract.noPool(),
        contract.resolved(),
        contract.winningSide(),
        contract.getState(),
        contract.getImpliedOdds()
      ]);

      setData({
        question,
        targetPrice,
        lockTime,
        yesPool,
        noPool,
        resolved,
        winningSide,
        state,
        yesPct: Number(odds[0]) / 100, // Assuming 10000 BP
        noPct: Number(odds[1]) / 100,
      });

      // Fetch user allowance for MockUSDC
      if (account) {
        const usdc = new ethers.Contract(CONFIG.MockUSDC, MockUSDCAbi, signer);
        const allow = await usdc.allowance(account, address);
        setAllowance(allow);
      }
    } catch (err) {
      console.error("Error fetching campaign data:", err);
    }
  }, [address, signer, account]);

  const approveUSDC = async (amount) => {
    if (!signer || !address) return;
    setLoading(true);
    try {
      const usdc = new ethers.Contract(CONFIG.MockUSDC, MockUSDCAbi, signer);
      const tx = await usdc.approve(address, amount);
      await tx.wait();
      await fetchCampaignData();
      return tx.hash;
    } catch (err) {
      console.error("Approval error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const join = async (side, amount) => {
    if (!signer) return;
    setLoading(true);
    try {
      const contract = new ethers.Contract(address, CampaignAbi, signer);
      const tx = await contract.join(side, amount);
      await tx.wait();
      await fetchCampaignData();
      return tx.hash;
    } catch (err) {
      console.error("Join error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resolve = async (side) => {
    if (!signer) return;
    setLoading(true);
    try {
      const contract = new ethers.Contract(address, CampaignAbi, signer);
      const tx = await contract.resolve(side);
      await tx.wait();
      await fetchCampaignData();
    } catch (err) {
      console.error("Resolve error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const claim = async (tokenId) => {
    if (!signer) return;
    try {
      const contract = new ethers.Contract(address, CampaignAbi, signer);
      const tx = await contract.claim(tokenId);
      await tx.wait();
      return tx.hash;
    } catch (err) {
      console.error("Claim error:", err);
      throw err;
    }
  };

  useEffect(() => {
    fetchCampaignData();
    const interval = setInterval(fetchCampaignData, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, [fetchCampaignData]);

  return { data, loading, allowance, approveUSDC, join, resolve, claim, fetchCampaignData };
};
