import os from 'os';

/**
 * Get real system hardware stats (CPU, RAM, OS, Uptime)
 */
export function getSystemHardwareInfo() {
  const cpus = os.cpus();
  const totalMemGB = (os.totalmem() / (1024 ** 3)).toFixed(1);
  const freeMemGB = (os.freemem() / (1024 ** 3)).toFixed(1);
  const usedMemGB = (totalMemGB - freeMemGB).toFixed(1);
  const memUsagePercent = Math.round((usedMemGB / totalMemGB) * 100);

  return {
    platform: os.platform(),
    osRelease: os.release(),
    architecture: os.arch(),
    cpuModel: cpus[0] ? cpus[0].model.trim() : 'Unknown CPU',
    cpuCores: cpus.length,
    totalRAM: `${totalMemGB} GB`,
    usedRAM: `${usedMemGB} GB (${memUsagePercent}%)`,
    freeRAM: `${freeMemGB} GB`,
    gpu: 'NVIDIA GeForce RTX 4050 Laptop GPU (6GB VRAM)',
    uptimeHours: (os.uptime() / 3600).toFixed(1)
  };
}
