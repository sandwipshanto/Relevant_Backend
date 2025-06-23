const cron = require('node-cron');
const JobQueue = require('./SimpleJobQueue');
const User = require('../models/User');

class CronService {
    constructor() {
        this.jobs = new Map();
        this.setupCronJobs();
    }

    setupCronJobs() {
        // Monitor channels every 2 hours
        const channelMonitoringJob = cron.schedule('0 */2 * * *', async () => {
            console.log('Starting scheduled channel monitoring...');
            try {
                await JobQueue.queueChannelMonitoring();
                console.log('Channel monitoring job queued successfully');
            } catch (error) {
                console.error('Error queueing channel monitoring:', error);
            }
        }, {
            scheduled: false,
            timezone: "UTC"
        });

        this.jobs.set('channel-monitoring', channelMonitoringJob);

        // Process user subscriptions daily at 6 AM UTC
        const userSubscriptionJob = cron.schedule('0 6 * * *', async () => {
            console.log('Starting daily user subscription processing...');
            try {
                const users = await User.find({
                    'youtubeSources.0': { $exists: true }
                }).select('_id');

                console.log(`Processing subscriptions for ${users.length} users`);

                for (const user of users) {
                    await JobQueue.queueUserSubscriptionProcessing(user._id.toString());
                }

                console.log('All user subscription jobs queued successfully');
            } catch (error) {
                console.error('Error processing user subscriptions:', error);
            }
        }, {
            scheduled: false,
            timezone: "UTC"
        });

        this.jobs.set('user-subscriptions', userSubscriptionJob);

        // Cleanup old content weekly on Sunday at 2 AM UTC
        const cleanupJob = cron.schedule('0 2 * * 0', async () => {
            console.log('Starting weekly cleanup...');
            try {
                await this.performCleanup();
                console.log('Weekly cleanup completed');
            } catch (error) {
                console.error('Error during weekly cleanup:', error);
            }
        }, {
            scheduled: false,
            timezone: "UTC"
        });

        this.jobs.set('weekly-cleanup', cleanupJob);

        console.log('Cron jobs configured:');
        console.log('- Channel monitoring: Every 2 hours');
        console.log('- User subscriptions: Daily at 6 AM UTC');
        console.log('- Weekly cleanup: Sunday at 2 AM UTC');
    }

    async performCleanup() {
        const Content = require('../models/Content');
        const UserContent = require('../models/UserContent');

        try {
            // Delete content older than 30 days that hasn't been saved by any user
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            const oldContent = await Content.find({
                createdAt: { $lt: thirtyDaysAgo }
            });

            let deletedCount = 0;
            for (const content of oldContent) {
                // Check if any user has saved this content
                const savedUserContent = await UserContent.findOne({
                    contentId: content._id,
                    saved: true
                });

                if (!savedUserContent) {
                    // Delete associated UserContent entries
                    await UserContent.deleteMany({
                        contentId: content._id
                    });

                    // Delete the content
                    await Content.findByIdAndDelete(content._id);
                    deletedCount++;
                }
            }

            // Clean up dismissed UserContent older than 7 days
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const dismissedResult = await UserContent.deleteMany({
                dismissed: true,
                updatedAt: { $lt: sevenDaysAgo }
            });

            console.log(`Cleanup completed: ${deletedCount} old content items deleted, ${dismissedResult.deletedCount} dismissed entries cleaned up`);

            return {
                deletedContent: deletedCount,
                deletedDismissed: dismissedResult.deletedCount
            };

        } catch (error) {
            console.error('Error during cleanup:', error);
            throw error;
        }
    }

    startAll() {
        console.log('Starting all cron jobs...');
        this.jobs.forEach((job, name) => {
            job.start();
            console.log(`Started cron job: ${name}`);
        });
    }

    stopAll() {
        console.log('Stopping all cron jobs...');
        this.jobs.forEach((job, name) => {
            job.stop();
            console.log(`Stopped cron job: ${name}`);
        });
    }

    getStatus() {
        const status = {};
        this.jobs.forEach((job, name) => {
            status[name] = {
                running: job.running || false,
                scheduled: job.scheduled || false
            };
        });
        return status;
    }

    // Manual trigger methods for testing
    async triggerChannelMonitoring() {
        console.log('Manually triggering channel monitoring...');
        return await JobQueue.queueChannelMonitoring();
    }

    async triggerUserSubscriptionProcessing(userId) {
        console.log(`Manually triggering subscription processing for user: ${userId}`);
        return await JobQueue.queueUserSubscriptionProcessing(userId);
    }

    async triggerCleanup() {
        console.log('Manually triggering cleanup...');
        return await this.performCleanup();
    }
}

module.exports = new CronService();
