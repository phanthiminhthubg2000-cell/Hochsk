import { db } from "../firebase";
import { doc, setDoc, increment, getDoc } from "firebase/firestore";

// Hàm cập nhật Tiến trình học (Cộng XP và nâng điểm Kỹ năng)
export const updateUserProgress = async (userId, xpToAdd, skillToUpdate = null, skillValue = 0) => {
  if (!userId) return { success: false };
  
  try {
    const userRef = doc(db, "user_progress", userId);
    
    let updateData = {
      "profile.hsk_xp": increment(xpToAdd),
      "profile.last_active": new Date()
    };

    if (skillToUpdate) {
      updateData[`skill_map.${skillToUpdate}`] = increment(skillValue); 
    }

    await setDoc(userRef, updateData, { merge: true });
    return { success: true };
  } catch (error) {
    console.error("Lỗi cập nhật tiến trình:", error);
    return { success: false, error };
  }
};

// Hàm ghi nhận "Mã gen lỗi sai" (Error DNA)
export const logUserError = async (userId, errorWordOrRule) => {
  if (!userId || !errorWordOrRule) return;
  
  try {
    const userRef = doc(db, "user_progress", userId);
    await setDoc(userRef, {
      [`error_dna.${errorWordOrRule}`]: increment(1)
    }, { merge: true });
  } catch (error) {
    console.error("Lỗi ghi nhận Error DNA:", error);
  }
};