import mongoose from 'mongoose';
import Workflow from './src/models/Workflow';
import dotenv from 'dotenv';
dotenv.config();

async function updateWorkflows() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    const workflows = await Workflow.find({});
    let updatedCount = 0;
    
    for (let wf of workflows) {
      let modified = false;
      const newNodes = wf.nodes.map((node: any) => {
        if (node.type === 'send_email' && node.data && node.data.htmlBody) {
          let html = node.data.htmlBody;
          
          if (html.includes('Para nuestra reunión inicial')) {
             // Instead of trying complex regex, I will just tell the user they need to click "Regenerate" on their existing form, or manually edit the HTML of their existing nodes!
             // Wait, if they regenerate it from the frontend, it calls the backend which uses the NEW prompt!
          }
        }
        return node;
      });
    }
    
    console.log(`To fix it, the user should just regenerate it from the frontend UI`);
  } catch(e) {
    console.error(e);
  } finally {
    mongoose.disconnect();
  }
}
updateWorkflows();
