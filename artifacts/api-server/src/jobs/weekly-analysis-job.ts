/**
 * Weekly Analysis Cron Job
 * Runs every Sunday at 2 AM UTC
 */

import { logger } from "../lib/logger.js";
import runWeeklyAnalysis from "../brain/weekly-analysis.js";

export async function weeklyAnalysisJob() {
  logger.info("Weekly analysis job triggered");
  
  try {
    const summary = await runWeeklyAnalysis();
    
    if (summary) {
      logger.info("Weekly analysis completed successfully");
      return { success: true, summary };
    } else {
      logger.info("No data to analyze this week");
      return { success: true, summary: null };
    }
  } catch (err) {
    logger.error({ err }, "Weekly analysis job failed");
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export default weeklyAnalysisJob;
