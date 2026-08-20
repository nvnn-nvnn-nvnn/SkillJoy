import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUser } from '@/lib/stores';
import {
  listMySkills, getSkillWithBlocks, updateSkill, deleteSkill,
  addBlock, updateBlock, deleteBlock, reorderBlocks, publishSkill, publishUpdate,
} from '@/lib/skills';
import { Trash2, Send, EyeOff, Puzzle } from 'lucide-react';
import { uploadCover } from '@/lib/storage';
import { startSubscription } from '@/lib/billing';
import { BLOCK_TYPES } from '@/lib/blockTypes';
import { PRODUCT_TYPES, TYPE_BY_ID } from '@/lib/productTypes';
import BlockEditor from '@/components/BlockEditor';
import MarkdownEditor from '@/components/MarkdownEditor';
import CourseStructure from '@/components/CourseStructure';
import BackLink from '@/components/BackLink';
import { useDialog } from '@/components/Dialog';



const SERVICE_HINTS = {
  digital:    { content: 'Add a File block for the download buyers get, plus any guide or video that explains it.' },
  coaching:   { content: 'Add a Coaching block with your booking link so buyers can schedule after paying.' },
  course:     { content: 'Break your course into sections, then add video, guide, or file lessons inside each — in the order students should follow.' },
  membership: { content: 'Add the content members get ongoing access to — you can push updates any time.' },
  webinar:    { content: 'Add a Video block for the recording or a Guide with the join link and details.' },
  lead:       { content: 'Keep it light — a single File or Guide block is enough for a free lead magnet.' },
  bundle:     { content: 'Add everything included in the bundle as separate blocks.' },
};


export default function SkillBuilder(){




    return (


        <div>

        </div>
    );
}